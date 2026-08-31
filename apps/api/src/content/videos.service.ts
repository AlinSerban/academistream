import { Inject, Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Db } from "@academistream/db";
import { courses, videos } from "@academistream/db";
import { DRIZZLE } from "../db/db.module";
import type { CreateVideoInput, PublishState, UpdateVideoInput } from "./types";
import { eq, and } from 'drizzle-orm';
import type { StorageService } from "../storage/storage.types";
import { STORAGE } from "../storage/storage.module";
import { KafkaProducerService } from "../kafka/kafka.producer";
import { AuditService } from "../audit/audit.service";
import { QuotasService } from "../quotas/quotas.service";

@Injectable()
export class VideosService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        @Inject(STORAGE) private readonly storage: StorageService,
        private readonly kafka: KafkaProducerService,
        private readonly audit: AuditService,
        private readonly quotas: QuotasService,
    ) { }

    async create(tenantId: number, input: CreateVideoInput) {
        await this.assertCourseInTenant(input.courseId, tenantId);
        await this.quotas.assertCanAddVideo(tenantId);

        const [video] = await this.db.insert(videos).values({
            tenantId,
            courseId: input.courseId,
            title: input.title,
        }).returning();

        if (!video) throw new NotFoundException();

        return video;
    }

    async update(videoId: number, input: UpdateVideoInput, tenantId: number) {
        const [updated] = await this.db
            .update(videos)
            .set({ title: input.title, updatedAt: new Date() })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!updated) throw new NotFoundException();
        return updated;
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
            .returning();

        if (!updated) throw new NotFoundException();

        if (publishState === 'published') {
            await this.audit.record({
                tenantId,
                actorUserId,
                action: 'video.published',
                entityType: 'video',
                entityId: videoId,
            });
        }

        return updated;
    }

    async getVideoById(videoId: number, tenantId: number) {
        const [video] = await this.db.select()
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1);

        if (!video) throw new NotFoundException();
        return video;
    }

    async listAll(tenantId: number) {
        return await this.db.select().from(videos).where(eq(videos.tenantId, tenantId));
    }

    async listByCourse(courseId: number, tenantId: number) {
        await this.assertCourseInTenant(courseId, tenantId);

        return await this.db.select()
            .from(videos)
            .where(and(eq(videos.courseId, courseId), eq(videos.tenantId, tenantId)));
    }

    async deleteVideo(videoId: number, tenantId: number) {
        const [deleted] = await this.db.delete(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!deleted) throw new NotFoundException();

        return deleted;
    }

    async uploadVideo(videoId: number, tenantId: number, file: Express.Multer.File) {
        await this.getVideoById(videoId, tenantId);
        const key = `tenants/${tenantId}/videos/${videoId}/source.mp4`;

        await this.storage.putObject({
            key,
            body: file.buffer,
            contentType: file.mimetype
        });

        const [updated] = await this.db
            .update(videos)
            .set({
                storageKey: key,
                mediaStatus: 'queued',
                updatedAt: new Date(),
            })
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .returning();

        if (!updated) throw new NotFoundException();

        await this.kafka.sendVideoProcessingJob({
            videoId,
            tenantId,
            storageKey: key,
        });

        return updated;
    }

    async getPlaybackUrl(videoId: number, tenantId: number, role: string) {
        const video = await this.getVideoById(videoId, tenantId);
        if (video.mediaStatus !== 'ready')
            throw new NotFoundException();

        const playbackKey = video.playbackKey ?? video.storageKey;
        if (playbackKey == null)
            throw new NotFoundException();

        if (role === 'learner' && video.publishState !== 'published')
            throw new ForbiddenException();

        const url = await this.storage.getSignedGetUrl(playbackKey);

        return { url, expiresIn: 3600 };
    }

    private async assertCourseInTenant(courseId: number, tenantId: number) {
        const [course] = await this.db.select()
            .from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
            .limit(1);

        if (!course) throw new NotFoundException();
    }
}
