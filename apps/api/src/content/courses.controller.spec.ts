import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import type { JwtPayload } from '../auth/types';

describe('CoursesController', () => {
  let controller: CoursesController;
  let coursesService: {
    listAll: jest.Mock;
    getCourseById: jest.Mock;
  };

  beforeEach(async () => {
    coursesService = {
      listAll: jest.fn(),
      getCourseById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    }).compile();

    controller = module.get(CoursesController);
  });

  it('readAll scopes to Acme tenantId from JWT', async () => {
    const user: JwtPayload = {
      sub: 2,
      username: 'Acme Admin',
      isPlatformAdmin: false,
      roles: [{ tenantId: 10, role: 'tenant_admin' }],
    };
    coursesService.listAll.mockResolvedValue([{ id: 1, title: 'Acme 101' }]);

    await expect(
      controller.readAll({ user } as unknown as Request),
    ).resolves.toEqual([{ id: 1, title: 'Acme 101' }]);
    expect(coursesService.listAll).toHaveBeenCalledWith(10);
  });

  it('read uses Globex tenantId so Acme cannot fetch Globex course via controller', async () => {
    const user: JwtPayload = {
      sub: 3,
      username: 'Globex Admin',
      isPlatformAdmin: false,
      roles: [{ tenantId: 20, role: 'tenant_admin' }],
    };
    coursesService.getCourseById.mockResolvedValue({ id: 99, tenantId: 20 });

    await expect(
      controller.read('99', { user } as unknown as Request),
    ).resolves.toEqual({ id: 99, tenantId: 20 });
    expect(coursesService.getCourseById).toHaveBeenCalledWith(99, 20);
    expect(coursesService.getCourseById).not.toHaveBeenCalledWith(99, 10);
  });
});
