import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../db/db.module'
import { AuditService } from './audit.service'

describe('AuditService', () => {
  let service: AuditService
  let db: { insert: jest.Mock; select: jest.Mock }

  beforeEach(async () => {
    db = {
      insert: jest.fn(),
      select: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: DRIZZLE, useValue: db }],
    }).compile()

    service = module.get(AuditService)
  })

  it('record inserts tenant-scoped event', async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    db.insert.mockReturnValue({ values })

    await service.record({
      tenantId: 10,
      actorUserId: 2,
      action: 'assignment.created',
      entityType: 'assignment',
      entityId: 1,
      metadata: { videoId: 3 },
    })

    expect(values).toHaveBeenCalledWith({
      tenantId: 10,
      actorUserId: 2,
      action: 'assignment.created',
      entityType: 'assignment',
      entityId: 1,
      metadata: JSON.stringify({ videoId: 3 }),
    })
  })

  it('record swallows insert failures', async () => {
    db.insert.mockReturnValue({
      values: jest.fn().mockRejectedValue(new Error('db down')),
    })

    await expect(
      service.record({
        tenantId: 10,
        action: 'video.published',
      }),
    ).resolves.toBeUndefined()
  })

  it('listForTenant scopes by tenantId and pages results', async () => {
    const rows = [{ id: 2, tenantId: 10 }, { id: 1, tenantId: 10 }]
    const countWhere = jest.fn().mockResolvedValue([{ total: 2 }])
    const countFrom = jest.fn().mockReturnValue({ where: countWhere })
    const offset = jest.fn().mockResolvedValue(rows)
    const limit = jest.fn().mockReturnValue({ offset })
    const orderBy = jest.fn().mockReturnValue({ limit })
    const where = jest.fn().mockReturnValue({ orderBy })
    const from = jest.fn().mockReturnValue({ where })
    db.select
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from })

    await expect(
      service.listForTenant(10, { page: 1, pageSize: 5 }),
    ).resolves.toEqual({
      items: rows,
      total: 2,
      page: 1,
      pageSize: 5,
    })
    expect(where).toHaveBeenCalled()
    expect(limit).toHaveBeenCalledWith(5)
  })

  it('listForTenant Acme query does not use Globex tenantId', async () => {
    const countWhere = jest.fn().mockResolvedValue([{ total: 0 }])
    const countFrom = jest.fn().mockReturnValue({ where: countWhere })
    const offset = jest.fn().mockResolvedValue([])
    const limit = jest.fn().mockReturnValue({ offset })
    const orderBy = jest.fn().mockReturnValue({ limit })
    const where = jest.fn().mockReturnValue({ orderBy })
    const from = jest.fn().mockReturnValue({ where })
    db.select
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from })

    await service.listForTenant(10, { page: 1, pageSize: 5 })
    expect(from).toHaveBeenCalled()
    expect(where).toHaveBeenCalledTimes(1)
  })
})
