jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { Response } from 'express';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findUser: jest.Mock;
    findUserById: jest.Mock;
    findMembershipsByUserId: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findUser: jest.fn(),
      findUserById: jest.fn(),
      findMembershipsByUserId: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('throws if user not found', async () => {
    usersService.findUser.mockResolvedValue(undefined);
    await expect(
      service.signIn('a@b.com', 'x', {} as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws if password does not match', async () => {
    const user = {
      id: 1,
      passwordHash: 'test123',
      name: 'John',
      email: 'John@gmail.com',
      isPlatformAdmin: true,
    };

    usersService.findUser.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.signIn('John@gmail.com', 'x', {} as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logs in', async () => {
    const user = {
      id: 1,
      passwordHash: 'test123',
      name: 'John',
      email: 'John@gmail.com',
      isPlatformAdmin: false,
    };

    const res = { cookie: jest.fn() } as unknown as Response;

    usersService.findUser.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    usersService.findMembershipsByUserId.mockResolvedValue([]);
    jwtService.signAsync
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce('access-token');

    await expect(service.signIn('John@gmail.com', 'x', res)).resolves.toEqual({
      access_token: 'access-token',
    });

    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-token',
      expect.any(Object),
    );
  });

  it('refresh preserves roles and isPlatformAdmin in access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 1,
      username: 'John',
      isPlatformAdmin: false,
      roles: [{ tenantId: 10, role: 'instructor' }],
    });
    usersService.findUserById.mockResolvedValue({
      id: 1,
      name: 'John',
      email: 'a@b.com',
      isPlatformAdmin: false,
    });
    usersService.findMembershipsByUserId.mockResolvedValue([
      { tenantId: 10, role: 'instructor' },
    ]);
    jwtService.signAsync.mockResolvedValue('new-access-token');

    await expect(service.refresh('refresh-token')).resolves.toEqual({
      access_token: 'new-access-token',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      username: 'John',
      isPlatformAdmin: false,
      roles: [{ tenantId: 10, role: 'instructor' }],
    });
  });
});
