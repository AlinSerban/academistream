import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../db/db.module';
import { NotificationsService } from '../notifications/notifications.service';
import type { MediaConvertService } from './media-convert.service';
import { VideoProcessingService } from './video-processing.service';

describe('VideoProcessingService', () => {
    let service: VideoProcessingService;
    let db: { select: jest.Mock; update: jest.Mock };
    let notifications: { notifyTenantStaff: jest.Mock };
    let configGet: jest.Mock;
    let mediaConvert: { submitTranscodeJob: jest.Mock };

    beforeEach(async () => {
        db = { select: jest.fn(), update: jest.fn() };
        notifications = {
            notifyTenantStaff: jest.fn().mockResolvedValue(undefined),
        };
        configGet = jest.fn().mockReturnValue(undefined);
        mediaConvert = { submitTranscodeJob: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VideoProcessingService,
                { provide: DRIZZLE, useValue: db },
                {
                    provide: ConfigService,
                    useValue: { get: configGet },
                },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        service = module.get(VideoProcessingService);
    });

    function mockVideoLookup(video: Record<string, unknown>) {
        db.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([video]),
                }),
            }),
        });
    }

    function mockUpdateChain() {
        db.update.mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(undefined),
            }),
        });
    }

    it('notifies tenant staff when local processing fails', async () => {
        mockVideoLookup({
            id: 3,
            tenantId: 10,
            title: 'Safety 101',
            mediaStatus: 'queued',
            mediaConvertJobId: null,
        });
        mockUpdateChain();

        await service.handle({
            videoId: 3,
            tenantId: 10,
            storageKey: 'tenants/10/videos/3/missing.mp4',
        });

        expect(notifications.notifyTenantStaff).toHaveBeenCalledWith({
            tenantId: 10,
            type: 'video.media_failed',
            title: 'Video processing failed',
            body: 'Processing failed for: Safety 101',
        });
    });

    it('submits MediaConvert job and stores job id when STORAGE_PROVIDER=s3', async () => {
        configGet.mockImplementation((key: string) => {
            const values: Record<string, string> = {
                STORAGE_PROVIDER: 's3',
                S3_BUCKET: 'test-bucket',
                AWS_REGION: 'eu-central-1',
                MEDIACONVERT_ROLE: 'arn:aws:iam::123:role/mc',
            };
            return values[key];
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VideoProcessingService,
                { provide: DRIZZLE, useValue: db },
                { provide: ConfigService, useValue: { get: configGet } },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        service = module.get(VideoProcessingService);
        (service as unknown as { processingMode: { kind: string; mediaConvert: MediaConvertService } })
            .processingMode = {
            kind: 'mediaconvert',
            mediaConvert: mediaConvert as unknown as MediaConvertService,
        };

        mockVideoLookup({
            id: 3,
            tenantId: 10,
            title: 'Safety 101',
            mediaStatus: 'queued',
            mediaConvertJobId: null,
        });

        const set = jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
        });
        db.update.mockReturnValue({ set });

        mediaConvert.submitTranscodeJob.mockResolvedValue('mc-job-abc');

        await service.handle({
            videoId: 3,
            tenantId: 10,
            storageKey: 'tenants/10/videos/3/source.mp4',
        });

        expect(mediaConvert.submitTranscodeJob).toHaveBeenCalledWith(
            'tenants/10/videos/3/source.mp4',
            'tenants/10/videos/3/output',
        );
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({ mediaConvertJobId: 'mc-job-abc' }),
        );
        expect(notifications.notifyTenantStaff).not.toHaveBeenCalled();
    });

    it('skips duplicate Kafka delivery when MediaConvert job already submitted', async () => {
        configGet.mockImplementation((key: string) => {
            const values: Record<string, string> = {
                STORAGE_PROVIDER: 's3',
                S3_BUCKET: 'test-bucket',
                AWS_REGION: 'eu-central-1',
                MEDIACONVERT_ROLE: 'arn:aws:iam::123:role/mc',
            };
            return values[key];
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VideoProcessingService,
                { provide: DRIZZLE, useValue: db },
                { provide: ConfigService, useValue: { get: configGet } },
                { provide: NotificationsService, useValue: notifications },
            ],
        }).compile();

        service = module.get(VideoProcessingService);
        (service as unknown as { processingMode: { kind: string; mediaConvert: MediaConvertService } })
            .processingMode = {
            kind: 'mediaconvert',
            mediaConvert: mediaConvert as unknown as MediaConvertService,
        };

        mockVideoLookup({
            id: 3,
            tenantId: 10,
            title: 'Safety 101',
            mediaStatus: 'processing',
            mediaConvertJobId: 'mc-job-existing',
        });

        await service.handle({
            videoId: 3,
            tenantId: 10,
            storageKey: 'tenants/10/videos/3/source.mp4',
        });

        expect(mediaConvert.submitTranscodeJob).not.toHaveBeenCalled();
        expect(db.update).not.toHaveBeenCalled();
    });
});
