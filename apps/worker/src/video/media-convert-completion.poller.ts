import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { videos, type Db } from '@academistream/db';
import { DRIZZLE } from '../db/db.module';
import { formatMediaConvertJobFailure } from './media-convert.service';
import type { MediaConvertJobState } from './media-convert.service';
import type { ProcessingMode } from './resolve-processing-mode';
import { resolveProcessingMode } from './resolve-processing-mode';
import { KafkaProducerService } from '../kafka/kafka.producer';

/**
 * Polls MediaConvert GetJob for videos still in processing.
 * SNS/EventBridge is the documented scale path.
 */
@Injectable()
export class MediaConvertCompletionPoller implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MediaConvertCompletionPoller.name);
    private readonly processingMode: ProcessingMode;
    private readonly pollIntervalMs: number;
    private timer?: ReturnType<typeof setInterval>;

    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        config: ConfigService,
        private readonly kafka: KafkaProducerService
    ) {
        this.processingMode = resolveProcessingMode(config);
        const rawInterval = config.get<string>('MEDIACONVERT_POLL_INTERVAL_MS');
        const parsed = rawInterval ? Number(rawInterval) : 15000;
        this.pollIntervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
    }

    onModuleInit(): void {
        if (this.processingMode.kind !== 'mediaconvert') {
            return;
        }

        this.timer = setInterval(() => {
            void this.poll().catch((err) => {
                this.logger.error('MediaConvert poll failed', err);
            });
        }, this.pollIntervalMs);

        this.logger.log(
            `MediaConvert completion poller started (interval=${this.pollIntervalMs}ms)`,
        );
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    async poll(): Promise<void> {
        if (this.processingMode.kind !== 'mediaconvert') {
            return;
        }

        const pending = await this.db.select()
            .from(videos)
            .where(eq(videos.mediaStatus, 'processing'));

        for (const video of pending) {
            if (!video.mediaConvertJobId) {
                continue;
            }
            await this.checkVideo(video);
        }
    }

    private async checkVideo(
        video: {
            id: number;
            tenantId: number;
            title: string;
            mediaConvertJobId: string | null;
        },
    ): Promise<void> {
        if (this.processingMode.kind !== 'mediaconvert' || !video.mediaConvertJobId) {
            return;
        }

        const job = await this.processingMode.mediaConvert.getJob(video.mediaConvertJobId);
        if (!job?.Status) {
            return;
        }

        const state = job.Status as MediaConvertJobState;

        if (state === 'COMPLETE') {
            const playbackKey = this.processingMode.mediaConvert.getPlaybackKeyFromJob(job);
            if (!playbackKey) {
                await this.markFailed(video, 'MediaConvert completed without output path');
                return;
            }

            const [updated] = await this.db.update(videos)
                .set({
                    mediaStatus: 'ready',
                    playbackKey,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(videos.id, video.id),
                    eq(videos.tenantId, video.tenantId),
                    eq(videos.mediaStatus, 'processing'),
                ))
                .returning();

            if (updated) {
                await this.kafka.sendMediaEventProcessingJob({
                    videoId: updated.id,
                    tenantId: updated.tenantId,
                    status: 'ready',
                    reason: null
                });

                this.logger.log(
                    `Video ready videoId=${video.id} playbackKey=${playbackKey}`,
                );
            }

            return;
        }

        if (state === 'ERROR' || state === 'CANCELED') {
            await this.markFailed(video, formatMediaConvertJobFailure(job));
        }
    }

    private async markFailed(
        video: { id: number; tenantId: number; title: string },
        reason: string,
    ): Promise<void> {
        const [updated] = await this.db.update(videos)
            .set({ mediaStatus: 'failed', mediaFailureReason: reason, updatedAt: new Date() })
            .where(and(
                eq(videos.id, video.id),
                eq(videos.tenantId, video.tenantId),
                eq(videos.mediaStatus, 'processing'),
            ))
            .returning();

        if (!updated) {
            return;
        }

        await this.kafka.sendMediaEventProcessingJob({
            videoId: updated.id,
            tenantId: updated.tenantId,
            status: 'failed',
            reason: updated.mediaFailureReason
        });

        this.logger.warn(`Video processing failed videoId=${video.id}: ${reason}`);
    }
}
