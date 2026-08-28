import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { DRIZZLE } from '../db/db.module'
import { AssignmentsService } from './assignments.service'
import { ProgressService } from './progress.service'
import { COMPLETION_PERCENT_THRESHOLD } from './types'

describe('ProgressService', () => {
  let service: ProgressService
  let db: { select: jest.Mock; insert: jest.Mock; update: jest.Mock }
  let assignmentsService: { assertAssigned: jest.Mock }
  let audit: { record: jest.Mock }
  let notifications: {
    notify: jest.Mock
    notifyTenantStaff: jest.Mock
  }

  const readyPublished = {
    id: 3,
    tenantId: 10,
    publishState: 'published',
    mediaStatus: 'ready',
  }

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    }
    assignmentsService = {
      assertAssigned: jest.fn().mockResolvedValue({ id: 1 }),
    }
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyTenantStaff: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: DRIZZLE, useValue: db },
        { provide: AssignmentsService, useValue: assignmentsService },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()

    service = module.get(ProgressService)
  })

  function mockVideoThenProgress(progressRows: unknown[]) {
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([readyPublished]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(progressRows),
          }),
        }),
      })
  }

  it('upsert creates progress for assigned learner', async () => {
    mockVideoThenProgress([])
    const created = {
      id: 1,
      tenantId: 10,
      userId: 4,
      videoId: 3,
      percent: 50,
      positionSeconds: 10,
    }
    db.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([created]),
      }),
    })

    const result = await service.upsertMine(
      10,
      4,
      { videoId: 3, percent: 50, positionSeconds: 10 },
      'learner',
    )

    expect(assignmentsService.assertAssigned).toHaveBeenCalledWith(10, 4, 3)
    expect(result.progress).toEqual(created)
    expect(result.completion).toBeNull()
    expect(result.threshold).toBe(COMPLETION_PERCENT_THRESHOLD)
  })

  it('upsert at threshold creates completion idempotently', async () => {
    mockVideoThenProgress([])
    const created = {
      id: 1,
      tenantId: 10,
      userId: 4,
      videoId: 3,
      percent: 95,
      positionSeconds: 0,
    }
    db.insert
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([created]),
        }),
      })
      // completion select empty then insert
    db.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })
    const completion = {
      id: 1,
      tenantId: 10,
      userId: 4,
      videoId: 3,
      completedAt: new Date(),
    }
    db.insert.mockReturnValueOnce({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([completion]),
      }),
    })

    // Re-setup selects: video, progress existing empty, completion existing empty
    db.select.mockReset()
    db.insert.mockReset()
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([readyPublished]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ title: 'Safety 101' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ assignedByUserId: 2 }]),
          }),
        }),
      })
    db.insert
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([created]),
        }),
      })
      .mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([completion]),
        }),
      })

    const result = await service.upsertMine(
      10,
      4,
      { videoId: 3, percent: 95 },
      'learner',
    )

    expect(result.completion).toEqual(completion)
  })

  it('upsert throws when video wrong tenant', async () => {
    db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(
      service.upsertMine(20, 4, { videoId: 3, percent: 10 }, 'learner'),
    ).rejects.toThrow(NotFoundException)
  })

  it('listForTenant returns only tenant rows', async () => {
    const rows = [{ id: 1, tenantId: 10, percent: 40 }]
    db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(rows),
      }),
    })

    await expect(service.listForTenant(10)).resolves.toEqual(rows)
  })

  it('learner without assignment is forbidden', async () => {
    db.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([readyPublished]),
        }),
      }),
    })
    assignmentsService.assertAssigned.mockRejectedValue(
      new ForbiddenException('Not assigned to this video'),
    )

    await expect(
      service.upsertMine(10, 4, { videoId: 3, percent: 10 }, 'learner'),
    ).rejects.toThrow(ForbiddenException)
  })
})
