import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import type { Db } from '@academistream/db'
import { completions, videos, watchProgress } from '@academistream/db'
import { and, eq } from 'drizzle-orm'
import { DRIZZLE } from '../db/db.module'
import { AssignmentsService } from './assignments.service'
import {
    COMPLETION_PERCENT_THRESHOLD,
    type UpsertProgressInput,
} from './types'

@Injectable()
export class ProgressService {
    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        private readonly assignmentsService: AssignmentsService,
    ) { }

    async upsertMine(
        tenantId: number,
        userId: number,
        input: UpsertProgressInput,
        role: string,
    ) {
        const percent = Math.min(100, Math.max(0, Math.round(input.percent)))
        const positionSeconds = Math.max(0, Math.round(input.positionSeconds ?? 0))

        const video = await this.assertVideoPlayable(
            input.videoId,
            tenantId,
            role,
        )

        if (role === 'learner') {
            await this.assignmentsService.assertAssigned(
                tenantId,
                userId,
                video.id,
            )
        }

        const [existing] = await this.db
            .select()
            .from(watchProgress)
            .where(
                and(
                    eq(watchProgress.tenantId, tenantId),
                    eq(watchProgress.userId, userId),
                    eq(watchProgress.videoId, video.id),
                ),
            )
            .limit(1)

        let progress
        if (existing) {
            const nextPercent = Math.max(existing.percent, percent)
            const nextPosition = Math.max(existing.positionSeconds, positionSeconds)
            const [updated] = await this.db
                .update(watchProgress)
                .set({
                    percent: nextPercent,
                    positionSeconds: nextPosition,
                    updatedAt: new Date(),
                })
                .where(eq(watchProgress.id, existing.id))
                .returning()
            progress = updated
        } else {
            const [created] = await this.db
                .insert(watchProgress)
                .values({
                    tenantId,
                    userId,
                    videoId: video.id,
                    percent,
                    positionSeconds,
                })
                .returning()
            progress = created
        }

        if (!progress) throw new NotFoundException()

        let completion = null
        if (progress.percent >= COMPLETION_PERCENT_THRESHOLD) {
            completion = await this.ensureCompletion(
                tenantId,
                userId,
                video.id,
            )
        }

        return { progress, completion, threshold: COMPLETION_PERCENT_THRESHOLD }
    }

    async listMine(tenantId: number, userId: number) {
        return this.db
            .select()
            .from(watchProgress)
            .where(
                and(
                    eq(watchProgress.tenantId, tenantId),
                    eq(watchProgress.userId, userId),
                ),
            )
    }

    async listForTenant(tenantId: number) {
        return this.db
            .select()
            .from(watchProgress)
            .where(eq(watchProgress.tenantId, tenantId))
    }

    async listCompletionsMine(tenantId: number, userId: number) {
        return this.db
            .select()
            .from(completions)
            .where(
                and(
                    eq(completions.tenantId, tenantId),
                    eq(completions.userId, userId),
                ),
            )
    }

    async listCompletionsForTenant(tenantId: number) {
        return this.db
            .select()
            .from(completions)
            .where(eq(completions.tenantId, tenantId))
    }

    private async ensureCompletion(
        tenantId: number,
        userId: number,
        videoId: number,
    ) {
        const [existing] = await this.db
            .select()
            .from(completions)
            .where(
                and(
                    eq(completions.tenantId, tenantId),
                    eq(completions.userId, userId),
                    eq(completions.videoId, videoId),
                ),
            )
            .limit(1)

        if (existing) return existing

        const [created] = await this.db
            .insert(completions)
            .values({ tenantId, userId, videoId })
            .returning()

        return created ?? null
    }

    private async assertVideoPlayable(
        videoId: number,
        tenantId: number,
        role: string,
    ) {
        const [video] = await this.db
            .select()
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1)

        if (!video) throw new NotFoundException('Video not found')

        if (video.mediaStatus !== 'ready') {
            throw new BadRequestException('Video is not ready')
        }

        if (role === 'learner' && video.publishState !== 'published') {
            throw new ForbiddenException('Learners can only track published videos')
        }

        return video
    }
}
