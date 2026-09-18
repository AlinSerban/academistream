import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import type { JwtPayload } from '../auth/types';

describe('VideosController', () => {
  let controller: VideosController;
  let videosService: {
    list: jest.Mock;
    getVideoById: jest.Mock;
    getPlaybackUrl: jest.Mock;
  };

  beforeEach(async () => {
    videosService = {
      list: jest.fn(),
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
    const page = { items: [{ id: 1 }], total: 1, page: 1, pageSize: 5, mediaBusy: false };
    videosService.list.mockResolvedValue(page);

    await expect(controller.readAll(reqAs(acmeAdmin))).resolves.toEqual(page);
    expect(videosService.list).toHaveBeenCalledWith(
      10,
      { page: 1, pageSize: 5 },
      undefined,
    );
  });

  it('readAll uses Globex tenantId so tenant A cannot list tenant B', async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 5, mediaBusy: false };
    videosService.list.mockResolvedValue(page);

    await expect(controller.readAll(reqAs(globexAdmin))).resolves.toEqual(page);
    expect(videosService.list).toHaveBeenCalledWith(
      20,
      { page: 1, pageSize: 5 },
      undefined,
    );
    expect(videosService.list).not.toHaveBeenCalledWith(
      10,
      expect.anything(),
      expect.anything(),
    );
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
