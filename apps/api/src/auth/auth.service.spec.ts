jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findUser: jest.Mock; findMembershipsByUserId: jest.Mock };
  let jwtService: { signAsync: jest.Mock, verifyAsync: jest.Mock }

  beforeEach(async () => {
    usersService = {
      findUser: jest.fn(),
      findMembershipsByUserId: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService
        },
        {
          provide: JwtService,
          useValue: jwtService
        }
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('throws if user not found', async () => {
    usersService.findUser.mockResolvedValue(undefined);
    await expect(service.signIn('a@b.com', 'x', {} as any))
      .rejects.toThrow(UnauthorizedException);
  });


  it('throws if password does not match', async () => {
    const user = {
      id: 1,
      passwordHash: 'test123',
      name: 'John',
      email: 'John@gmail.com',
      isPlatformAdmin: true
    }

    usersService.findUser.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.signIn('John@gmail.com', 'x', {} as any))
      .rejects.toThrow(UnauthorizedException);

  });

  it('logs in', async () => {
    const user = {
      id: 1,
      passwordHash: 'test123',
      name: 'John',
      email: 'John@gmail.com',
      isPlatformAdmin: false
    }

    const res = { cookie: jest.fn() };


    usersService.findUser.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    usersService.findMembershipsByUserId.mockResolvedValue([]);
    jwtService.signAsync
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce('access-token');

    await expect(service.signIn('John@gmail.com', 'x', res as any))
      .resolves.toEqual({ access_token: 'access-token' });

    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-token',
      expect.any(Object)
    )

  });
});
