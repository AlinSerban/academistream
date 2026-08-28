import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import bcrypt from 'bcrypt'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { QuotasService } from '../quotas/quotas.service'
import { DRIZZLE } from '../db/db.module'
import { InvitesService } from './invites.service'

describe('InvitesService', () => {
  let service: InvitesService
  let db: {
    select: jest.Mock
    insert: jest.Mock
    update: jest.Mock
  }
  let audit: { record: jest.Mock }
  let notifications: { notify: jest.Mock }
  let quotas: { assertCanAddMember: jest.Mock }

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    }
    audit = { record: jest.fn().mockResolvedValue(undefined) }
    notifications = { notify: jest.fn().mockResolvedValue(undefined) }
    quotas = { assertCanAddMember: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: DRIZZLE, useValue: db },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
        { provide: QuotasService, useValue: quotas },
      ],
    }).compile()

    service = module.get(InvitesService)
  })

  it('create rejects invalid role', async () => {
    await expect(
      service.create(10, 1, {
        email: 'x@acme.test',
        role: 'superuser' as 'learner',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('create rejects duplicate pending invite', async () => {
    const limit = jest.fn().mockResolvedValue([{ id: 1 }])
    const where = jest.fn().mockReturnValue({ limit })
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(
      service.create(10, 1, { email: 'x@acme.test', role: 'learner' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('accept rejects unknown token', async () => {
    const where = jest.fn().mockResolvedValue([
      {
        id: 1,
        tokenHash: await bcrypt.hash('other-token', 4),
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
      },
    ])
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(
      service.accept({ token: 'bad-token' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('accept rejects expired invite', async () => {
    const raw = 'good-token'
    const tokenHash = await bcrypt.hash(raw, 4)
    const where = jest.fn().mockResolvedValue([
      {
        id: 1,
        email: 'new@acme.test',
        role: 'learner',
        tenantId: 10,
        tokenHash,
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
      },
    ])
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(service.accept({ token: raw })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('accept creates membership for existing user', async () => {
    const raw = 'good-token'
    const tokenHash = await bcrypt.hash(raw, 4)
    const invite = {
      id: 1,
      email: 'learner@acme.test',
      role: 'learner' as const,
      tenantId: 10,
      tokenHash,
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 60_000),
    }

    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([invite]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: 4, email: 'learner@acme.test' },
            ]),
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

    db.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    })
    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })

    await expect(service.accept({ token: raw })).resolves.toEqual({
      userId: 4,
      email: 'learner@acme.test',
      tenantId: 10,
      role: 'learner',
    })
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invite.accepted', tenantId: 10 }),
    )
    expect(quotas.assertCanAddMember).toHaveBeenCalledWith(10)
  })
})
