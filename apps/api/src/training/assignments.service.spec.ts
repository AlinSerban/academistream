import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { DRIZZLE } from '../db/db.module'
import { AssignmentsService } from './assignments.service'

describe('AssignmentsService', () => {
  let service: AssignmentsService
  let db: {
    select: jest.Mock
    insert: jest.Mock
    delete: jest.Mock
  }
  let audit: { record: jest.Mock }
  let notifications: { notify: jest.Mock }

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
    }
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    notifications = { notify: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: DRIZZLE, useValue: db },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()

    service = module.get(AssignmentsService)
  })

  function mockSelectLimit(rows: unknown[]) {
    const limit = jest.fn().mockResolvedValue(rows)
    const where = jest.fn().mockReturnValue({ limit })
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })
  }

  function mockSelectWhere(rows: unknown[]) {
    const where = jest.fn().mockResolvedValue(rows)
    const innerJoin = jest.fn().mockReturnValue({ where })
    const from = jest.fn().mockReturnValue({ where, innerJoin })
    db.select.mockReturnValue({ from })
  }

  it('create assigns learner to published video in tenant', async () => {
    mockSelectLimit([
      { id: 3, tenantId: 10, publishState: 'published', title: 'Safety 101' },
    ])
    // second select for learner membership
    const limit2 = jest.fn().mockResolvedValue([
      { userId: 4, tenantId: 10, role: 'learner' },
    ])
    const where2 = jest.fn().mockReturnValue({ limit: limit2 })
    const from2 = jest.fn().mockReturnValue({ where: where2 })
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: 3, tenantId: 10, publishState: 'published', title: 'Safety 101' },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({ from: from2 })

    const created = {
      id: 1,
      tenantId: 10,
      videoId: 3,
      userId: 4,
      assignedByUserId: 2,
    }
    const returning = jest.fn().mockResolvedValue([created])
    const values = jest.fn().mockReturnValue({ returning })
    db.insert.mockReturnValue({ values })

    await expect(
      service.create(10, 2, { videoId: 3, userId: 4 }),
    ).resolves.toEqual(created)
    expect(values).toHaveBeenCalledWith({
      tenantId: 10,
      videoId: 3,
      userId: 4,
      assignedByUserId: 2,
    })
    expect(notifications.notify).toHaveBeenCalledWith({
      tenantId: 10,
      userId: 4,
      type: 'assignment.created',
      title: 'New assignment',
      body: 'You were assigned: Safety 101',
    })
  })

  it('create throws when video is in another tenant', async () => {
    mockSelectLimit([])

    await expect(
      service.create(20, 2, { videoId: 3, userId: 4 }),
    ).rejects.toThrow(NotFoundException)
  })

  it('listForTenant scopes to caller tenant', async () => {
    const rows = [{ id: 1, tenantId: 10 }]
    mockSelectWhere(rows)

    await expect(service.listForTenant(10)).resolves.toEqual(rows)
  })

  it('delete throws when assignment missing for tenant', async () => {
    const returning = jest.fn().mockResolvedValue([])
    const where = jest.fn().mockReturnValue({ returning })
    db.delete.mockReturnValue({ where })

    await expect(service.delete(99, 10)).rejects.toThrow(NotFoundException)
  })

  it('create rejects draft video', async () => {
    mockSelectLimit([
      { id: 3, tenantId: 10, publishState: 'draft' },
    ])

    await expect(
      service.create(10, 2, { videoId: 3, userId: 4 }),
    ).rejects.toThrow(BadRequestException)
  })
})
