import { Inject, Injectable, Logger } from '@nestjs/common';
import { VideoProcessingJob } from '../types';
import { videos, type Db } from "@academistream/db";
import { access } from 'fs/promises';
import path from 'path';
import { eq, and } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../db/db.module';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveStorageRoot } from '../storage/resolve-storage-root';
import type { ProcessingMode } from './resolve-processing-mode';
import { resolveProcessingMode } from './resolve-processing-mode';

@Injectable()
export class VideoProcessingService {
    private readonly logger = new Logger(VideoProcessingService.name);
    private readonly rootDir: string;
    private readonly processingMode: ProcessingMode;

    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        config: ConfigService,
        private readonly notifications: NotificationsService,
    ) {
        this.rootDir = resolveStorageRoot(config.get<string>('STORAGE_LOCAL_ROOT'));
        this.processingMode = resolveProcessingMode(config);
    }

    async handle(job: VideoProcessingJob): Promise<void> {
        this.logger.log(
            `Received job videoId=${job.videoId} tenantId=${job.tenantId} key=${job.storageKey}`,
        );

        const [video] = await this.findVideo(job.videoId, job.tenantId);
        if (!video) return;
        if (video.mediaStatus === 'ready') return;
        if (video.mediaStatus === 'processing' && video.mediaConvertJobId) return;

        await this.setStatus(job, 'processing');

        try {
            if (this.processingMode.kind === 'mediaconvert') {
                await this.submitMediaConvertJob(job);
                return;
            }

            await access(path.join(this.rootDir, job.storageKey));
            await this.setStatus(job, 'ready');
        }
        catch {
            await this.setStatus(job, 'failed');
            await this.notifyMediaFailed(job, video.title);
        }
    }

    private async submitMediaConvertJob(job: VideoProcessingJob): Promise<void> {
        if (this.processingMode.kind !== 'mediaconvert') {
            throw new Error('MediaConvert is not configured');
        }

        const outputPrefix = `tenants/${job.tenantId}/videos/${job.videoId}/output`;
        const mediaConvertJobId = await this.processingMode.mediaConvert.submitTranscodeJob(
            job.storageKey,
            outputPrefix,
        );

        this.logger.log(
            `Submitted MediaConvert jobId=${mediaConvertJobId} videoId=${job.videoId}`,
        );

        await this.db.update(videos)
            .set({
                mediaConvertJobId,
                updatedAt: new Date(),
            })
            .where(and(eq(videos.id, job.videoId), eq(videos.tenantId, job.tenantId)));
    }

    /**
     * Videos have no uploader column — notify tenant_admin, else first instructor.
     */
    private async notifyMediaFailed(
        job: VideoProcessingJob,
        videoTitle: string,
    ): Promise<void> {
        await this.notifications.notifyTenantStaff({
            tenantId: job.tenantId,
            type: 'video.media_failed',
            title: 'Video processing failed',
            body: `Processing failed for: ${videoTitle}`,
        });
    }

    private async findVideo(videoId: number, tenantId: number) {
        return await this.db.select()
            .from(videos)
            .where(and(eq(videos.id, videoId), eq(videos.tenantId, tenantId)))
            .limit(1);
    }

    private async setStatus(job: VideoProcessingJob, status: 'processing' | 'ready' | 'failed') {
        return await this.db.update(videos)
            .set({ mediaStatus: status, updatedAt: new Date() })
            .where(and(eq(videos.id, job.videoId), eq(videos.tenantId, job.tenantId)));
    }
}
