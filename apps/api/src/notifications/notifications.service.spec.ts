import { NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DRIZZLE } from '../db/db.module'
import { MAIL } from '../mail/mail.module'
import { NotificationsService } from './notifications.service'

describe('NotificationsService', () => {
  let service: NotificationsService
  let db: {
    insert: jest.Mock
    select: jest.Mock
    update: jest.Mock
  }
  let mail: { send: jest.Mock }

  beforeEach(async () => {
    db = { insert: jest.fn(), select: jest.fn(), update: jest.fn() }
    mail = { send: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: DRIZZLE, useValue: db },
        { provide: MAIL, useValue: mail },
      ],
    }).compile()

    service = module.get(NotificationsService)
  })

  it('notify inserts in-app notification row', async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    db.insert.mockReturnValue({ values })

    await service.notify({
      tenantId: 10,
      userId: 4,
      type: 'assignment.created',
      title: 'New assignment',
      body: 'Watch Safety 101',
    })

    expect(values).toHaveBeenCalledWith({
      tenantId: 10,
      userId: 4,
      type: 'assignment.created',
      title: 'New assignment',
      body: 'Watch Safety 101',
    })
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('notify calls mail stub when email is provided', async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    db.insert.mockReturnValue({ values })

    await service.notify({
      tenantId: 10,
      userId: 4,
      type: 'invite.created',
      title: 'You are invited',
      body: 'Join Acme',
      email: 'new@acme.test',
    })

    expect(mail.send).toHaveBeenCalledWith({
      to: 'new@acme.test',
      subject: 'You are invited',
      body: 'Join Acme',
    })
  })

  it('notify swallows insert failures', async () => {
    db.insert.mockReturnValue({
      values: jest.fn().mockRejectedValue(new Error('db down')),
    })

    await expect(
      service.notify({
        tenantId: 10,
        userId: 4,
        type: 'completion.created',
      }),
    ).resolves.toBeUndefined()
  })

  it('notify swallows mail failures after successful insert', async () => {
    const values = jest.fn().mockResolvedValue(undefined)
    db.insert.mockReturnValue({ values })
    mail.send.mockRejectedValue(new Error('mail down'))

    await expect(
      service.notify({
        tenantId: 10,
        userId: 4,
        type: 'invite.created',
        email: 'x@acme.test',
        title: 'Invite',
      }),
    ).resolves.toBeUndefined()
  })

  it('listForUser scopes by tenantId and userId', async () => {
    const rows = [{ id: 2, tenantId: 10, userId: 4 }]
    const limit = jest.fn().mockResolvedValue(rows)
    const orderBy = jest.fn().mockReturnValue({ limit })
    const where = jest.fn().mockReturnValue({ orderBy })
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(service.listForUser(10, 4, 25)).resolves.toEqual(rows)
    expect(limit).toHaveBeenCalledWith(25)
  })

  it('markRead does not update another users notification', async () => {
    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(service.markRead(10, 4, 99)).rejects.toThrow(NotFoundException)
    await expect(service.markRead(10, 5, 99)).rejects.toThrow(NotFoundException)
  })

  it('markAllRead updates only unread rows for user in tenant', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
    const where = jest.fn().mockReturnValue({ returning })
    const set = jest.fn().mockReturnValue({ where })
    db.update.mockReturnValue({ set })

    await expect(service.markAllRead(10, 4)).resolves.toHaveLength(2)
    expect(set).toHaveBeenCalledWith({ readAt: expect.any(Date) })
  })
})
