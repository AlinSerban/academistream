import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { Request } from 'express'
import { AssignmentsController } from './assignments.controller'
import { AssignmentsService } from './assignments.service'
import type { JwtPayload } from '../auth/types'

describe('AssignmentsController', () => {
  let controller: AssignmentsController
  let assignmentsService: {
    listForTenant: jest.Mock
    listMine: jest.Mock
    create: jest.Mock
  }

  beforeEach(async () => {
    assignmentsService = {
      listForTenant: jest.fn(),
      listMine: jest.fn(),
      create: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        { provide: AssignmentsService, useValue: assignmentsService },
      ],
    }).compile()

    controller = module.get(AssignmentsController)
  })

  const acmeAdmin: JwtPayload = {
    sub: 2,
    username: 'Acme Admin',
    isPlatformAdmin: false,
    roles: [{ tenantId: 10, role: 'tenant_admin' }],
  }

  const globexAdmin: JwtPayload = {
    sub: 3,
    username: 'Globex Admin',
    isPlatformAdmin: false,
    roles: [{ tenantId: 20, role: 'tenant_admin' }],
  }

  it('listAll uses Acme tenantId from JWT', async () => {
    assignmentsService.listForTenant.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
    })
    await controller.listAll({ user: acmeAdmin } as unknown as Request)
    expect(assignmentsService.listForTenant).toHaveBeenCalledWith(10, {
      page: 1,
      pageSize: 5,
    })
  })

  it('listAll uses Globex tenantId so Acme cannot list Globex', async () => {
    assignmentsService.listForTenant.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
    })
    await controller.listAll({ user: globexAdmin } as unknown as Request)
    expect(assignmentsService.listForTenant).toHaveBeenCalledWith(20, {
      page: 1,
      pageSize: 5,
    })
    expect(assignmentsService.listForTenant).not.toHaveBeenCalledWith(
      10,
      expect.anything(),
    )
  })

  it('listMine passes user.sub and tenantId', async () => {
    const learner: JwtPayload = {
      sub: 4,
      username: 'Learner',
      isPlatformAdmin: false,
      roles: [{ tenantId: 10, role: 'learner' }],
    }
    assignmentsService.listMine.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      stats: { assigned: 0, inProgress: 0, completed: 0, notStarted: 0 },
      continueAssignment: null,
    })
    await controller.listMine({ user: learner } as unknown as Request)
    expect(assignmentsService.listMine).toHaveBeenCalledWith(10, 4, {
      page: 1,
      pageSize: 5,
    })
  })

  it('create forbids users with no membership', () => {
    const platform: JwtPayload = {
      sub: 1,
      username: 'Platform',
      isPlatformAdmin: true,
      roles: [],
    }
    expect(() =>
      controller.create(
        { videoId: 1, userId: 4 },
        { user: platform } as unknown as Request,
      ),
    ).toThrow(ForbiddenException)
  })
})
