import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { DRIZZLE } from '../db/db.module';
import { STORAGE } from '../storage/storage.module';
import { PlaybackUrlService } from '../storage/playback-url.service';
import { KafkaProducerService } from '../kafka/kafka.producer';
import { QuotasService } from '../quotas/quotas.service';
import { VideosService } from './videos.service';

describe('VideosService', () => {
  let service: VideosService;
  let db: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };
  let storage: { putObject: jest.Mock };
  let playbackUrls: { getSignedGetUrl: jest.Mock };
  let kafka: { sendVideoProcessingJob: jest.Mock };
  let audit: { record: jest.Mock };
  let quotas: { assertCanAddVideo: jest.Mock };

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    storage = {
      putObject: jest.fn(),
    };
    playbackUrls = {
      getSignedGetUrl: jest.fn(),
    };
    kafka = {
      sendVideoProcessingJob: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    quotas = { assertCanAddVideo: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: DRIZZLE, useValue: db },
        { provide: STORAGE, useValue: storage },
        { provide: PlaybackUrlService, useValue: playbackUrls },
        { provide: KafkaProducerService, useValue: kafka },
        { provide: AuditService, useValue: audit },
        { provide: QuotasService, useValue: quotas },
      ],
    }).compile();

    service = module.get(VideosService);
  });

  function mockSelectLimit(rows: unknown[]) {
    const limit = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    db.select.mockReturnValue({ from });
  }

  function mockSelectWhere(rows: unknown[]) {
    const where = jest.fn().mockResolvedValue(rows);
    const from = jest.fn().mockReturnValue({ where });
    db.select.mockReturnValue({ from });
  }

  const readyPublished = {
    id: 3,
    tenantId: 10,
    courseId: 1,
    title: 'Welcome',
    storageKey: 'tenants/10/videos/3/source.mp4',
    publishState: 'published' as const,
    mediaStatus: 'ready' as const,
  };

  it('getVideoById throws when Globex asks for Acme video', async () => {
    mockSelectLimit([]);

    await expect(service.getVideoById(3, 20)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('listAll returns only the caller tenant rows', async () => {
    const rows = [{ id: 3, tenantId: 10, title: 'Welcome' }];
    mockSelectWhere(rows);

    await expect(service.listAll(10)).resolves.toEqual(rows);
  });

  it('create succeeds when course is in tenant', async () => {
    mockSelectLimit([{ id: 1, tenantId: 10, title: 'Course' }]);
    const created = {
      id: 5,
      tenantId: 10,
      courseId: 1,
      title: 'New clip',
    };
    const returning = jest.fn().mockResolvedValue([created]);
    const values = jest.fn().mockReturnValue({ returning });
    db.insert.mockReturnValue({ values });

    await expect(
      service.create(10, { courseId: 1, title: 'New clip' }),
    ).resolves.toEqual(created);
    expect(quotas.assertCanAddVideo).toHaveBeenCalledWith(10)
    expect(values).toHaveBeenCalledWith({
      tenantId: 10,
      courseId: 1,
      title: 'New clip',
    });
  });

  it('create propagates quota rejection', async () => {
    mockSelectLimit([{ id: 1, tenantId: 10, title: 'Course' }])
    quotas.assertCanAddVideo.mockRejectedValue(
      new BadRequestException('Tenant video limit reached'),
    )

    await expect(
      service.create(10, { courseId: 1, title: 'New clip' }),
    ).rejects.toThrow(BadRequestException)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('uploadVideo stores tenant-scoped key, queues media, and produces Kafka job', async () => {
    mockSelectLimit([{ id: 3, tenantId: 10, courseId: 1, title: 'Clip' }]);
    const updated = {
      id: 3,
      tenantId: 10,
      storageKey: 'tenants/10/videos/3/source.mp4',
      mediaStatus: 'queued' as const,
    };
    const returning = jest.fn().mockResolvedValue([updated]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    db.update.mockReturnValue({ set });

    const file = {
      buffer: Buffer.from('video-bytes'),
      mimetype: 'video/mp4',
    } as Express.Multer.File;
    storage.putObject.mockResolvedValue({ key: 'tenants/10/videos/3/source.mp4' });

    await expect(service.uploadVideo(3, 10, file)).resolves.toEqual(updated);

    expect(storage.putObject).toHaveBeenCalledWith({
      key: 'tenants/10/videos/3/source.mp4',
      body: file.buffer,
      contentType: 'video/mp4',
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: 'tenants/10/videos/3/source.mp4',
        mediaStatus: 'queued',
      }),
    );
    expect(kafka.sendVideoProcessingJob).toHaveBeenCalledWith({
      videoId: 3,
      tenantId: 10,
      storageKey: 'tenants/10/videos/3/source.mp4',
    });
  });

  it('uploadVideo rejects cross-tenant access', async () => {
    mockSelectLimit([]);

    const file = { buffer: Buffer.from('x'), mimetype: 'video/mp4' } as Express.Multer.File;

    await expect(service.uploadVideo(3, 20, file)).rejects.toThrow(NotFoundException);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(kafka.sendVideoProcessingJob).not.toHaveBeenCalled();
  });

  it('getPlaybackUrl succeeds for ready published video', async () => {
    mockSelectLimit([readyPublished]);
    playbackUrls.getSignedGetUrl.mockResolvedValue('file:///tmp/video.mp4');

    await expect(
      service.getPlaybackUrl(3, 10, 'learner'),
    ).resolves.toEqual({ url: 'file:///tmp/video.mp4', expiresIn: 3600 });

    expect(playbackUrls.getSignedGetUrl).toHaveBeenCalledWith(
      readyPublished.storageKey,
    );
  });

  it('getPlaybackUrl prefers playbackKey for transcoded output', async () => {
    mockSelectLimit([
      {
        ...readyPublished,
        playbackKey: 'tenants/10/videos/3/output/source.mp4',
      },
    ]);
    playbackUrls.getSignedGetUrl.mockResolvedValue('https://d123.cloudfront.net/signed');

    await expect(
      service.getPlaybackUrl(3, 10, 'learner'),
    ).resolves.toEqual({
      url: 'https://d123.cloudfront.net/signed',
      expiresIn: 3600,
    });

    expect(playbackUrls.getSignedGetUrl).toHaveBeenCalledWith(
      'tenants/10/videos/3/output/source.mp4',
    );
  });

  it('getPlaybackUrl throws NotFound when wrong tenant', async () => {
    mockSelectLimit([]);

    await expect(
      service.getPlaybackUrl(3, 20, 'tenant_admin'),
    ).rejects.toThrow(NotFoundException);
    expect(playbackUrls.getSignedGetUrl).not.toHaveBeenCalled();
  });

  it('getPlaybackUrl throws NotFound when media not ready', async () => {
    mockSelectLimit([
      { ...readyPublished, mediaStatus: 'queued', storageKey: 'k' },
    ]);

    await expect(
      service.getPlaybackUrl(3, 10, 'tenant_admin'),
    ).rejects.toThrow(NotFoundException);
    expect(playbackUrls.getSignedGetUrl).not.toHaveBeenCalled();
  });

  it('getPlaybackUrl forbids learner on draft', async () => {
    mockSelectLimit([
      { ...readyPublished, publishState: 'draft' },
    ]);

    await expect(
      service.getPlaybackUrl(3, 10, 'learner'),
    ).rejects.toThrow(ForbiddenException);
    expect(playbackUrls.getSignedGetUrl).not.toHaveBeenCalled();
  });

  it('getPlaybackUrl allows instructor on draft ready', async () => {
    mockSelectLimit([
      { ...readyPublished, publishState: 'draft' },
    ]);
    playbackUrls.getSignedGetUrl.mockResolvedValue('file:///tmp/draft.mp4');

    await expect(
      service.getPlaybackUrl(3, 10, 'instructor'),
    ).resolves.toEqual({ url: 'file:///tmp/draft.mp4', expiresIn: 3600 });
  });
});
