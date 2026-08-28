import { ForbiddenException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { Request } from 'express'
import type { JwtPayload } from '../auth/types'
import { QuotasController } from './quotas.controller'
import { QuotasService } from './quotas.service'

describe('QuotasController', () => {
  let controller: QuotasController
  let quotasService: { getStatusForTenant: jest.Mock }

  beforeEach(async () => {
    quotasService = { getStatusForTenant: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuotasController],
      providers: [{ provide: QuotasService, useValue: quotasService }],
    }).compile()

    controller = module.get(QuotasController)
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

  it('usage uses Acme tenantId from JWT', async () => {
    quotasService.getStatusForTenant.mockResolvedValue({ tenantId: 10 })
    await controller.usage({ user: acmeAdmin } as unknown as Request)
    expect(quotasService.getStatusForTenant).toHaveBeenCalledWith(10)
  })

  it('usage uses Globex tenantId so Acme cannot read Globex', async () => {
    quotasService.getStatusForTenant.mockResolvedValue({ tenantId: 20 })
    await controller.usage({ user: globexAdmin } as unknown as Request)
    expect(quotasService.getStatusForTenant).toHaveBeenCalledWith(20)
    expect(quotasService.getStatusForTenant).not.toHaveBeenCalledWith(10)
  })

  it('forbids users with no tenant membership', () => {
    const platform: JwtPayload = {
      sub: 1,
      username: 'Platform',
      isPlatformAdmin: true,
      roles: [],
    }
    expect(() =>
      controller.usage({ user: platform } as unknown as Request),
    ).toThrow(ForbiddenException)
  })
})
