import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AuditService } from '../audit/audit.service'
import { DRIZZLE } from '../db/db.module'
import { MembersService } from './members.service'

describe('MembersService', () => {
  let service: MembersService
  let db: {
    select: jest.Mock
    delete: jest.Mock
  }
  let audit: { record: jest.Mock }

  beforeEach(async () => {
    db = {
      select: jest.fn(),
      delete: jest.fn(),
    }
    audit = { record: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: DRIZZLE, useValue: db },
        { provide: AuditService, useValue: audit },
      ],
    }).compile()

    service = module.get(MembersService)
  })

  it('list scopes to tenant via join query', async () => {
    const rows = [
      {
        userId: 1,
        email: 'admin@acme.test',
        name: 'Admin',
        role: 'tenant_admin',
        membershipId: 1,
      },
    ]
    const where = jest.fn().mockResolvedValue(rows)
    const innerJoin = jest.fn().mockReturnValue({ where })
    const from = jest.fn().mockReturnValue({ innerJoin })
    db.select.mockReturnValue({ from })

    await expect(service.list(10)).resolves.toEqual(rows)
    expect(where).toHaveBeenCalledTimes(1)
  })

  it('remove throws when membership missing for tenant', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const where = jest.fn().mockReturnValue({ limit })
    const from = jest.fn().mockReturnValue({ where })
    db.select.mockReturnValue({ from })

    await expect(service.remove(10, 99, 1)).rejects.toThrow(NotFoundException)
  })

  it('remove blocks last tenant_admin', async () => {
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: 1, userId: 1, tenantId: 10, role: 'tenant_admin' },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 1 }]),
        }),
      })

    await expect(service.remove(10, 1, 1)).rejects.toThrow(BadRequestException)
  })

  it('remove deletes membership and audits', async () => {
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: 5, userId: 4, tenantId: 10, role: 'learner' },
            ]),
          }),
        }),
      })

    const deleted = { id: 5, userId: 4, tenantId: 10, role: 'learner' }
    db.delete.mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([deleted]),
      }),
    })

    await expect(service.remove(10, 4, 1)).resolves.toEqual(deleted)
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'membership.removed',
        tenantId: 10,
        entityId: 4,
      }),
    )
  })
})
