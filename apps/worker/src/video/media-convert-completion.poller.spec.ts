import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { NotificationsService } from '../notifications/notifications.service';
import type { MediaConvertService } from './media-convert.service';
import { MediaConvertCompletionPoller } from './media-convert-completion.poller';

describe('MediaConvertCompletionPoller', () => {
    let poller: MediaConvertCompletionPoller;
    let db: { select: jest.Mock; update: jest.Mock };
    let notifications: { notifyTenantStaff: jest.Mock };
    let kafka: { sendMediaEventProcessingJob: jest.Mock };
    let mediaConvert: {
        getJob: jest.Mock;
        getPlaybackKeyFromJob: jest.Mock;
    };

    beforeEach(async () => {
        db = { select: jest.fn(), update: jest.fn() };
        notifications = { notifyTenantStaff: jest.fn().mockResolvedValue(undefined) };
        kafka = {
            sendMediaEventProcessingJob: jest.fn().mockResolvedValue(undefined),
        };
        mediaConvert = {
            getJob: jest.fn(),
            getPlaybackKeyFromJob: jest.fn(),
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
                { provide: KafkaProducerService, useValue: kafka },
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

        mediaConvert.getJob.mockResolvedValue({ Status: 'COMPLETE' });
        mediaConvert.getPlaybackKeyFromJob.mockReturnValue(
            'tenants/10/videos/3/output/source.mp4',
        );

        const returning = jest.fn().mockResolvedValue([{
            id: 3,
            tenantId: 10,
            mediaStatus: 'ready',
            mediaFailureReason: null,
        }]);
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
        expect(kafka.sendMediaEventProcessingJob).toHaveBeenCalledWith({
            videoId: 3,
            tenantId: 10,
            status: 'ready',
            reason: null,
        });
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });

    it('marks failed and publishes media event when job errors', async () => {
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

        mediaConvert.getJob.mockResolvedValue({
            Status: 'ERROR',
            ErrorCode: 1040,
            ErrorMessage: 'Invalid selector_sequence_id [0] specified for audio_description [1].',
        });

        const returning = jest.fn().mockResolvedValue([{
            id: 3,
            tenantId: 10,
            mediaStatus: 'failed',
            mediaFailureReason: 'MediaConvert job ERROR (1040): Invalid selector_sequence_id [0] specified for audio_description [1].',
        }]);
        const where = jest.fn().mockReturnValue({ returning });
        db.update.mockReturnValue({ set: jest.fn().mockReturnValue({ where }) });

        await poller.poll();

        expect(kafka.sendMediaEventProcessingJob).toHaveBeenCalledWith({
            videoId: 3,
            tenantId: 10,
            status: 'failed',
            reason: 'MediaConvert job ERROR (1040): Invalid selector_sequence_id [0] specified for audio_description [1].',
        });
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
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

        mediaConvert.getJob.mockResolvedValue({ Status: 'COMPLETE' });
        mediaConvert.getPlaybackKeyFromJob.mockReturnValue('tenants/10/videos/3/output/a.mp4');

        const returning = jest.fn().mockResolvedValue([]);
        db.update.mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({ returning }),
            }),
        });

        await poller.poll();

        expect(kafka.sendMediaEventProcessingJob).not.toHaveBeenCalled();
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });
});
