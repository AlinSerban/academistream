import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { Request } from 'express'
import type { JwtPayload } from '../auth/types'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'

describe('NotificationsController', () => {
  let controller: NotificationsController
  let notificationsService: {
    listForUser: jest.Mock
    markRead: jest.Mock
    markAllRead: jest.Mock
  }

  beforeEach(async () => {
    notificationsService = {
      listForUser: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile()

    controller = module.get(NotificationsController)
  })

  const acmeLearner: JwtPayload = {
    sub: 4,
    username: 'Learner',
    isPlatformAdmin: false,
    roles: [{ tenantId: 10, role: 'learner' }],
  }

  const globexLearner: JwtPayload = {
    sub: 5,
    username: 'Globex Learner',
    isPlatformAdmin: false,
    roles: [{ tenantId: 20, role: 'learner' }],
  }

  it('list scopes by JWT tenant and user id', async () => {
    notificationsService.listForUser.mockResolvedValue([])
    await controller.list({ user: acmeLearner } as unknown as Request, '25')
    expect(notificationsService.listForUser).toHaveBeenCalledWith(10, 4, 25)
  })

  it('list uses Globex tenant so Acme user cannot list Globex rows', async () => {
    notificationsService.listForUser.mockResolvedValue([])
    await controller.list({ user: globexLearner } as unknown as Request)
    expect(notificationsService.listForUser).toHaveBeenCalledWith(20, 5, 50)
    expect(notificationsService.listForUser).not.toHaveBeenCalledWith(10, 4, 50)
  })

  it('markRead passes tenant and user from JWT', async () => {
    notificationsService.markRead.mockResolvedValue({ id: 7 })
    await controller.markRead('7', { user: acmeLearner } as unknown as Request)
    expect(notificationsService.markRead).toHaveBeenCalledWith(10, 4, 7)
  })

  it('markAllRead passes tenant and user from JWT', async () => {
    notificationsService.markAllRead.mockResolvedValue([])
    await controller.markAllRead({ user: acmeLearner } as unknown as Request)
    expect(notificationsService.markAllRead).toHaveBeenCalledWith(10, 4)
  })

  it('forbids users with no tenant membership', () => {
    const platform: JwtPayload = {
      sub: 1,
      username: 'Platform',
      isPlatformAdmin: true,
      roles: [],
    }
    expect(() =>
      controller.list({ user: platform } as unknown as Request),
    ).toThrow(ForbiddenException)
  })
})
