import {
    Inject,
    Injectable,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { courses, videos } from '@academistream/db'
import { DRIZZLE } from '../db/db.module'
import type { CreateVideoInput, MediaStatus, PublishState, UpdateVideoInput } from './types'
import { and, count, desc, eq, inArray, lt, type SQL } from 'drizzle-orm'
import type { StorageService } from '../storage/storage.types'
import { STORAGE } from '../storage/storage.tokens'
import { PlaybackUrlService } from '../storage/playback-url.service'
import { KafkaProducerService } from '../kafka/kafka.producer'
import { AuditService } from '../audit/audit.service'
import { QuotasService } from '../quotas/quotas.service'
import {
    pageOffset,
    toPageResult,
    type PageParams,
    type PageResult,
} from '../common/pagination'

export type VideoListItem = typeof videos.$inferSelect & {
    courseTitle: string | null
}

export type VideoListResult = PageResult<VideoListItem> & {
    mediaBusy: boolean
}

export type AssignableVideo = {
    id: number
    title: string
}

@Injectable()
export class VideosService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        @Inject(STORAGE) private readonly storage: StorageService,
        private readonly playbackUrls: PlaybackUrlService,
        private readonly kafka: KafkaProducerService,
        private readonly audit: AuditService,
        private readonly quotas: QuotasService,
    ) { }

    async create(tenantId: number, input: CreateVideoInput) {
        await this.assertCourseInTenant(input.courseId, tenantId)
        await this.quotas.assertCanAddVideo(tenantId)

        const [video] = await this.db
            .insert(videos)
            .values({
                tenantId,
                courseId: input.courseId,
                title: input.title,
            })
            .returning()

        if (!video) throw new NotFoundException()
        return video
    }

    async update(videoId: number, input: UpdateVideoInput, tenantId: number) {
        const [updated] = await this.db
            .update(videos)
            .set({ title: input.title, updatedAt: new Date() })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning()

        if (!updated) throw new NotFoundException()
        return updated
    }

    async publish(
        videoId: number,
        tenantId: number,
        publishState: PublishState,
        actorUserId?: number,
    ) {
        const [updated] = await this.db
            .update(videos)
            .set({ publishState, updatedAt: new Date() })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning()

        if (!updated) throw new NotFoundException()

        if (publishState === 'published') {
            await this.audit.record({
                tenantId,
                actorUserId,
                action: 'video.published',
                entityType: 'video',
                entityId: videoId,
            })
        }

        return updated
    }

    async getVideoById(videoId: number, tenantId: number) {
        const [video] = await this.db
            .select()
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1)

        if (!video) throw new NotFoundException()
        return video
    }

    async list(
        tenantId: number,
        params: PageParams,
        mediaStatus?: MediaStatus,
    ): Promise<VideoListResult> {
        const filters: SQL[] = [eq(videos.tenantId, tenantId)]
        if (mediaStatus) filters.push(eq(videos.mediaStatus, mediaStatus))
        const whereClause = and(...filters)

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(videos)
            .where(whereClause)

        const items = await this.db
            .select({
                id: videos.id,
                tenantId: videos.tenantId,
                courseId: videos.courseId,
                title: videos.title,
                storageKey: videos.storageKey,
                playbackKey: videos.playbackKey,
                mediaConvertJobId: videos.mediaConvertJobId,
                publishState: videos.publishState,
                mediaStatus: videos.mediaStatus,
                mediaFailureReason: videos.mediaFailureReason,
                createdAt: videos.createdAt,
                updatedAt: videos.updatedAt,
                courseTitle: courses.title,
            })
            .from(videos)
            .leftJoin(courses, eq(courses.id, videos.courseId))
            .where(whereClause)
            .orderBy(desc(videos.id))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        const [busyRow] = await this.db
            .select({ total: count() })
            .from(videos)
            .where(
                and(
                    eq(videos.tenantId, tenantId),
                    inArray(videos.mediaStatus, ['queued', 'processing']),
                ),
            )

        return {
            ...toPageResult(items, Number(totalRow?.total ?? 0), params),
            mediaBusy: Number(busyRow?.total ?? 0) > 0,
        }
    }

    async listAssignable(
        tenantId: number,
        params: PageParams,
    ): Promise<PageResult<AssignableVideo>> {
        const whereClause = and(
            eq(videos.tenantId, tenantId),
            eq(videos.publishState, 'published'),
            eq(videos.mediaStatus, 'ready'),
        )

        const [totalRow] = await this.db
            .select({ total: count() })
            .from(videos)
            .where(whereClause)

        const items = await this.db
            .select({
                id: videos.id,
                title: videos.title,
            })
            .from(videos)
            .where(whereClause)
            .orderBy(desc(videos.id))
            .limit(params.pageSize)
            .offset(pageOffset(params))

        return toPageResult(items, Number(totalRow?.total ?? 0), params)
    }

    async listByCourse(courseId: number, tenantId: number) {
        await this.assertCourseInTenant(courseId, tenantId)

        return await this.db
            .select()
            .from(videos)
            .where(and(eq(videos.courseId, courseId), eq(videos.tenantId, tenantId)))
    }

    async getStuckVideos(tenantId: number, minutes: number) {
        if (!Number.isFinite(minutes) || minutes <= 0) {
            throw new BadRequestException('olderThanMinutes must be a positive number')
        }

        const cutoff = new Date(Date.now() - minutes * 60_000)
        return await this.db
            .select()
            .from(videos)
            .where(
                and(
                    eq(videos.tenantId, tenantId),
                    inArray(videos.mediaStatus, ['queued', 'processing']),
                    lt(videos.updatedAt, cutoff),
                ),
            )
    }

    async deleteVideo(videoId: number, tenantId: number) {
        const video = await this.getVideoById(videoId, tenantId)

        if (video.mediaStatus === 'processing') {
            throw new ConflictException('Cannot delete video while processing')
        }
        if (video.storageKey) await this.storage.deleteObject(video.storageKey)
        if (video.playbackKey && video.playbackKey !== video.storageKey) {
            await this.storage.deleteObject(video.playbackKey)
        }

        const [deleted] = await this.db
            .delete(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning()

        if (!deleted) throw new NotFoundException()
        return deleted
    }

    async uploadVideo(videoId: number, tenantId: number, file: Express.Multer.File) {
        await this.getVideoById(videoId, tenantId)
        const key = `tenants/${tenantId}/videos/${videoId}/source.mp4`

        await this.storage.putObject({
            key,
            body: file.buffer,
            contentType: file.mimetype,
        })

        const [updated] = await this.db
            .update(videos)
            .set({
                storageKey: key,
                mediaStatus: 'queued',
                mediaFailureReason: null,
                mediaConvertJobId: null,
                updatedAt: new Date(),
            })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning()

        if (!updated) throw new NotFoundException()

        await this.kafka.sendVideoProcessingJob({
            videoId,
            tenantId,
            storageKey: key,
            action: 'process',
        })

        return updated
    }

    async retryVideo(videoId: number, tenantId: number) {
        const video = await this.getVideoById(videoId, tenantId)

        if (video.mediaStatus !== 'failed' || video.storageKey == null) {
            throw new NotFoundException()
        }

        const [updated] = await this.db
            .update(videos)
            .set({
                mediaConvertJobId: null,
                playbackKey: null,
                mediaFailureReason: null,
                mediaStatus: 'queued',
                updatedAt: new Date(),
            })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning()

        if (!updated) throw new NotFoundException()

        await this.kafka.sendVideoProcessingJob({
            videoId,
            tenantId,
            storageKey: video.storageKey,
            action: 'process',
        })

        return updated
    }

    async cancelVideoProcessing(videoId: number, tenantId: number) {
        const video = await this.getVideoById(videoId, tenantId)
        if (video.mediaStatus !== 'processing' || !video.mediaConvertJobId) {
            throw new NotFoundException()
        }

        await this.kafka.sendVideoProcessingJob({
            videoId,
            tenantId,
            storageKey: '',
            action: 'cancel',
        })

        return video
    }

    async getPlaybackUrl(videoId: number, tenantId: number, role: string) {
        const video = await this.getVideoById(videoId, tenantId)
        if (video.mediaStatus !== 'ready') throw new NotFoundException()

        const playbackKey = video.playbackKey ?? video.storageKey
        if (playbackKey == null) throw new NotFoundException()

        if (role === 'learner' && video.publishState !== 'published') {
            throw new ForbiddenException()
        }

        const url = await this.playbackUrls.getSignedGetUrl(playbackKey)
        return { url, expiresIn: 3600 }
    }

    private async assertCourseInTenant(courseId: number, tenantId: number) {
        const [course] = await this.db
            .select({ id: courses.id })
            .from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .limit(1)

        if (!course) throw new NotFoundException()
    }
}
