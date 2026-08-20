import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import type { JwtPayload } from '../auth/types';

describe('TenantsController', () => {
  let controller: TenantsController;
  let tenantsService: { create: jest.Mock; getMe: jest.Mock };

  beforeEach(async () => {
    tenantsService = {
      create: jest.fn(),
      getMe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: tenantsService,
        },
      ],
    }).compile();

    controller = module.get(TenantsController);
  });

  it('register delegates to tenantsService.create', async () => {
    const body = {
      tenantName: 'Acme',
      adminEmail: 'admin@acme.local',
      adminName: 'Acme Admin',
      adminPassword: 'secret',
    };
    const expected = { tenant: { id: 1 }, admin: { id: 2, email: body.adminEmail } };
    tenantsService.create.mockResolvedValue(expected);

    await expect(controller.create(body)).resolves.toEqual(expected);
    expect(tenantsService.create).toHaveBeenCalledWith(body);
  });

  it('me uses Acme tenantId from JWT (not a client-supplied id)', async () => {
    const user: JwtPayload = {
      sub: 2,
      username: 'Acme Admin',
      isPlatformAdmin: false,
      roles: [{ tenantId: 10, role: 'tenant_admin' }],
    };
    const req = { user } as unknown as Request;
    const expected = { id: 10, name: 'Acme', status: 'active' };
    tenantsService.getMe.mockResolvedValue(expected);

    await expect(controller.me(req)).resolves.toEqual(expected);
    expect(tenantsService.getMe).toHaveBeenCalledWith(10);
  });

  it('me uses Globex tenantId so tenant A cannot read tenant B', async () => {
    const user: JwtPayload = {
      sub: 3,
      username: 'Globex Admin',
      isPlatformAdmin: false,
      roles: [{ tenantId: 20, role: 'tenant_admin' }],
    };
    const req = { user } as unknown as Request;
    const expected = { id: 20, name: 'Globex', status: 'active' };
    tenantsService.getMe.mockResolvedValue(expected);

    await expect(controller.me(req)).resolves.toEqual(expected);
    expect(tenantsService.getMe).toHaveBeenCalledWith(20);
    expect(tenantsService.getMe).not.toHaveBeenCalledWith(10);
  });

  it('me forbids users with no membership tenantId', async () => {
    const user: JwtPayload = {
      sub: 1,
      username: 'Platform',
      isPlatformAdmin: true,
      roles: [],
    };
    const req = { user } as unknown as Request;

    expect(() => controller.me(req)).toThrow(ForbiddenException);
    expect(tenantsService.getMe).not.toHaveBeenCalled();
  });
});
