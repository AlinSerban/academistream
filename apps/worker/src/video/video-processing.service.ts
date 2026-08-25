import { Inject, Injectable, Logger } from '@nestjs/common';
import { VideoProcessingJob } from '../types';
import { videos, type Db } from "@academistream/db";
import { access } from 'fs/promises';
import path from 'path';
import { eq, and } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../db/db.module';
import { resolveStorageRoot } from '../storage/resolve-storage-root';

@Injectable()
export class VideoProcessingService {
    private readonly logger = new Logger(VideoProcessingService.name);
    private readonly rootDir: string;

    constructor(
        @Inject(DRIZZLE) private readonly db: Db,
        config: ConfigService
    ) {
        this.rootDir = resolveStorageRoot(config.get<string>('STORAGE_LOCAL_ROOT'));
    }

    async handle(job: VideoProcessingJob): Promise<void> {
        this.logger.log(
            `Received job videoId=${job.videoId} tenantId=${job.tenantId} key=${job.storageKey}`,
        );

        const [video] = await this.findVideo(job.videoId, job.tenantId);
        if (!video) return;
        if (video.mediaStatus === 'ready') return;

        await this.setStatus(job, 'processing');

        try {

            //  Future MediaConvert (do not enable yet):
            //  await mediaConvert.send(new CreateJobCommand({
            //    Role: process.env.MEDIACONVERT_ROLE,
            //    Settings: {
            //      Inputs: [{ FileInput: `s3://${bucket}/${job.storageKey}` }],
            //      OutputGroups: [{ /* HLS/MP4 outputs to s3://... *\/ }],
            //    },
            //  }));
            //   then wait for job complete / SNS callback → set ready/failed

            await access(path.join(this.rootDir, job.storageKey));
            await this.setStatus(job, 'ready');
        }
        catch {
            await this.setStatus(job, 'failed')
        }
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
