import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../db/db.module'
import { NotificationsService } from '../notifications/notifications.service'
import { VideoProcessingService } from './video-processing.service'

describe('VideoProcessingService', () => {
  let service: VideoProcessingService
  let db: { select: jest.Mock; update: jest.Mock }
  let notifications: { notifyTenantStaff: jest.Mock }

  beforeEach(async () => {
    db = { select: jest.fn(), update: jest.fn() }
    notifications = {
      notifyTenantStaff: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoProcessingService,
        { provide: DRIZZLE, useValue: db },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()

    service = module.get(VideoProcessingService)
  })

  it('notifies tenant staff when processing fails', async () => {
    const video = {
      id: 3,
      tenantId: 10,
      title: 'Safety 101',
      mediaStatus: 'queued',
    }

    db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([video]),
        }),
      }),
    })

    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })

    await service.handle({
      videoId: 3,
      tenantId: 10,
      storageKey: 'tenants/10/videos/3/missing.mp4',
    })

    expect(notifications.notifyTenantStaff).toHaveBeenCalledWith({
      tenantId: 10,
      type: 'video.media_failed',
      title: 'Video processing failed',
      body: 'Processing failed for: Safety 101',
    })
  })
})
