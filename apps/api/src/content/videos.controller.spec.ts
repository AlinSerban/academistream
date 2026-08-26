import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import type { JwtPayload } from '../auth/types';

describe('VideosController', () => {
  let controller: VideosController;
  let videosService: {
    listAll: jest.Mock;
    getVideoById: jest.Mock;
    getPlaybackUrl: jest.Mock;
  };

  beforeEach(async () => {
    videosService = {
      listAll: jest.fn(),
      getVideoById: jest.fn(),
      getPlaybackUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [{ provide: VideosService, useValue: videosService }],
    }).compile();

    controller = module.get(VideosController);
  });

  function reqAs(user: JwtPayload) {
    return { user } as unknown as Request;
  }

  const acmeAdmin: JwtPayload = {
    sub: 2,
    username: 'Acme Admin',
    isPlatformAdmin: false,
    roles: [{ tenantId: 10, role: 'tenant_admin' }],
  };

  const globexAdmin: JwtPayload = {
    sub: 3,
    username: 'Globex Admin',
    isPlatformAdmin: false,
    roles: [{ tenantId: 20, role: 'tenant_admin' }],
  };

  const acmeLearner: JwtPayload = {
    sub: 4,
    username: 'Acme Learner',
    isPlatformAdmin: false,
    roles: [{ tenantId: 10, role: 'learner' }],
  };

  it('readAll uses Acme tenantId from JWT (not client-supplied)', async () => {
    videosService.listAll.mockResolvedValue([{ id: 1 }]);

    await expect(controller.readAll(reqAs(acmeAdmin))).resolves.toEqual([
      { id: 1 },
    ]);
    expect(videosService.listAll).toHaveBeenCalledWith(10);
  });

  it('readAll uses Globex tenantId so tenant A cannot list tenant B', async () => {
    videosService.listAll.mockResolvedValue([]);

    await expect(controller.readAll(reqAs(globexAdmin))).resolves.toEqual([]);
    expect(videosService.listAll).toHaveBeenCalledWith(20);
    expect(videosService.listAll).not.toHaveBeenCalledWith(10);
  });

  it('getPlaybackUrl passes tenantId and role from JWT', async () => {
    videosService.getPlaybackUrl.mockResolvedValue({
      url: 'file:///x',
      expiresIn: 3600,
    });

    await expect(
      controller.getPlaybackUrl('3', reqAs(acmeLearner)),
    ).resolves.toEqual({ url: 'file:///x', expiresIn: 3600 });

    expect(videosService.getPlaybackUrl).toHaveBeenCalledWith(
      3,
      10,
      'learner',
    );
  });

  it('getPlaybackUrl forbids users with no membership (no authZ tenant)', () => {
    const platform: JwtPayload = {
      sub: 1,
      username: 'Platform',
      isPlatformAdmin: true,
      roles: [],
    };

    expect(() =>
      controller.getPlaybackUrl('3', reqAs(platform)),
    ).toThrow(ForbiddenException);
    expect(videosService.getPlaybackUrl).not.toHaveBeenCalled();
  });
});
