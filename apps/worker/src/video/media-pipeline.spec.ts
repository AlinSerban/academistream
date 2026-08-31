import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { NotificationsService } from '../notifications/notifications.service';
import type { MediaConvertService } from './media-convert.service';
import { MediaConvertCompletionPoller } from './media-convert-completion.poller';
import { VideoProcessingService } from './video-processing.service';

/**
 * End-to-end media pipeline (mocked AWS + DB) — upload is covered in API tests.
 */
describe('AWS media pipeline (mocked)', () => {
    const awsConfig = {
        STORAGE_PROVIDER: 's3',
        S3_BUCKET: 'test-bucket',
        AWS_REGION: 'eu-central-1',
        MEDIACONVERT_ROLE: 'arn:aws:iam::123:role/mc',
    };

    let db: { select: jest.Mock; update: jest.Mock };
    let notifications: { notifyTenantStaff: jest.Mock };
    let mediaConvert: {
        submitTranscodeJob: jest.Mock;
        getJobState: jest.Mock;
        getPlaybackKeyForJob: jest.Mock;
    };
    let processing: VideoProcessingService;
    let poller: MediaConvertCompletionPoller;

    beforeEach(async () => {
        db = { select: jest.fn(), update: jest.fn() };
        notifications = { notifyTenantStaff: jest.fn().mockResolvedValue(undefined) };
        mediaConvert = {
            submitTranscodeJob: jest.fn(),
            getJobState: jest.fn(),
            getPlaybackKeyForJob: jest.fn(),
        };

        const configGet = jest.fn((key: string) => awsConfig[key as keyof typeof awsConfig]);

        const processingModule: TestingModule = await Test.createTestingModule({
            providers: [
                VideoProcessingService,
                { provide: DRIZZLE, useValue: db },
                { provide: ConfigService, useValue: { get: configGet } },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        processing = processingModule.get(VideoProcessingService);
        (processing as unknown as { processingMode: { kind: string; mediaConvert: MediaConvertService } })
            .processingMode = {
            kind: 'mediaconvert',
            mediaConvert: mediaConvert as unknown as MediaConvertService,
        };

        const pollerModule: TestingModule = await Test.createTestingModule({
            providers: [
                MediaConvertCompletionPoller,
                { provide: DRIZZLE, useValue: db },
                { provide: ConfigService, useValue: { get: configGet } },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        poller = pollerModule.get(MediaConvertCompletionPoller);
        (poller as unknown as { processingMode: { kind: string; mediaConvert: MediaConvertService } })
            .processingMode = {
            kind: 'mediaconvert',
            mediaConvert: mediaConvert as unknown as MediaConvertService,
        };
    });

    it('submit → poll complete yields ready video with playback key', async () => {
        const queuedVideo = {
            id: 3,
            tenantId: 10,
            title: 'Clip',
            mediaStatus: 'queued',
            mediaConvertJobId: null,
        };

        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([queuedVideo]),
                }),
            }),
        });

        const setProcessing = jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
        });
        const setJobId = jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
        });
        db.update
            .mockReturnValueOnce({ set: setProcessing })
            .mockReturnValueOnce({ set: setJobId });

        mediaConvert.submitTranscodeJob.mockResolvedValue('mc-job-1');

        await processing.handle({
            videoId: 3,
            tenantId: 10,
            storageKey: 'tenants/10/videos/3/source.mp4',
        });

        expect(mediaConvert.submitTranscodeJob).toHaveBeenCalledWith(
            'tenants/10/videos/3/source.mp4',
            'tenants/10/videos/3/output',
        );
        expect(setJobId).toHaveBeenCalledWith(
            expect.objectContaining({ mediaConvertJobId: 'mc-job-1' }),
        );

        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{
                    id: 3,
                    tenantId: 10,
                    title: 'Clip',
                    mediaConvertJobId: 'mc-job-1',
                }]),
            }),
        });

        mediaConvert.getJobState.mockResolvedValue('COMPLETE');
        mediaConvert.getPlaybackKeyForJob.mockResolvedValue(
            'tenants/10/videos/3/output/source.mp4',
        );

        const setReady = jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{ id: 3, mediaStatus: 'ready' }]),
            }),
        });
        db.update.mockReturnValue({ set: setReady });

        await poller.poll();

        expect(setReady).toHaveBeenCalledWith(
            expect.objectContaining({
                mediaStatus: 'ready',
                playbackKey: 'tenants/10/videos/3/output/source.mp4',
            }),
        );
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });
});
