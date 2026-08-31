import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { NotificationsService } from '../notifications/notifications.service';
import type { MediaConvertService } from './media-convert.service';
import { MediaConvertCompletionPoller } from './media-convert-completion.poller';

describe('MediaConvertCompletionPoller', () => {
    let poller: MediaConvertCompletionPoller;
    let db: { select: jest.Mock; update: jest.Mock };
    let notifications: { notifyTenantStaff: jest.Mock };
    let mediaConvert: {
        getJobState: jest.Mock;
        getPlaybackKeyForJob: jest.Mock;
    };

    beforeEach(async () => {
        db = { select: jest.fn(), update: jest.fn() };
        notifications = { notifyTenantStaff: jest.fn().mockResolvedValue(undefined) };
        mediaConvert = {
            getJobState: jest.fn(),
            getPlaybackKeyForJob: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MediaConvertCompletionPoller,
                { provide: DRIZZLE, useValue: db },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'STORAGE_PROVIDER') return 's3';
                            if (key === 'S3_BUCKET') return 'test-bucket';
                            if (key === 'AWS_REGION') return 'eu-central-1';
                            if (key === 'MEDIACONVERT_ROLE') return 'arn:aws:iam::123:role/mc';
                            return undefined;
                        }),
                    },
                },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        poller = module.get(MediaConvertCompletionPoller);
        (poller as unknown as { processingMode: { kind: string; mediaConvert: MediaConvertService } })
            .processingMode = {
            kind: 'mediaconvert',
            mediaConvert: mediaConvert as unknown as MediaConvertService,
        };
    });

    it('marks video ready with playback key when job completes', async () => {
        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{
                    id: 3,
                    tenantId: 10,
                    title: 'Clip',
                    mediaConvertJobId: 'mc-1',
                }]),
            }),
        });

        mediaConvert.getJobState.mockResolvedValue('COMPLETE');
        mediaConvert.getPlaybackKeyForJob.mockResolvedValue(
            'tenants/10/videos/3/output/source.mp4',
        );

        const returning = jest.fn().mockResolvedValue([{ id: 3, mediaStatus: 'ready' }]);
        const where = jest.fn().mockReturnValue({ returning });
        const set = jest.fn().mockReturnValue({ where });
        db.update.mockReturnValue({ set });

        await poller.poll();

        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                mediaStatus: 'ready',
                playbackKey: 'tenants/10/videos/3/output/source.mp4',
            }),
        );
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });

    it('marks failed and notifies when job errors', async () => {
        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{
                    id: 3,
                    tenantId: 10,
                    title: 'Clip',
                    mediaConvertJobId: 'mc-1',
                }]),
            }),
        });

        mediaConvert.getJobState.mockResolvedValue('ERROR');

        const returning = jest.fn().mockResolvedValue([{ id: 3, mediaStatus: 'failed' }]);
        const where = jest.fn().mockReturnValue({ returning });
        db.update.mockReturnValue({ set: jest.fn().mockReturnValue({ where }) });

        await poller.poll();

        expect(notifications.notifyTenantStaff).toHaveBeenCalledWith({
            tenantId: 10,
            type: 'video.media_failed',
            title: 'Video processing failed',
            body: 'Processing failed for: Clip',
        });
    });

    it('is idempotent when video already left processing state', async () => {
        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([{
                    id: 3,
                    tenantId: 10,
                    title: 'Clip',
                    mediaConvertJobId: 'mc-1',
                }]),
            }),
        });

        mediaConvert.getJobState.mockResolvedValue('COMPLETE');
        mediaConvert.getPlaybackKeyForJob.mockResolvedValue('tenants/10/videos/3/output/a.mp4');

        const returning = jest.fn().mockResolvedValue([]);
        db.update.mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({ returning }),
            }),
        });

        await poller.poll();

        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });
});
