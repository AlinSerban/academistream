import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import type { Response, Request } from 'express';
import type { JwtPayload, SignInDto } from './types';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    refresh: jest.Mock;
    signOut: jest.Mock;
    getMe: jest.Mock;
  };
  let loginRateLimit: { assertAllowed: jest.Mock };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      refresh: jest.fn(),
      signOut: jest.fn(),
      getMe: jest.fn(),
    };
    loginRateLimit = { assertAllowed: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: LoginRateLimitService, useValue: loginRateLimit },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('calls signIn with email, password and res after rate-limit check', async () => {
    const body: SignInDto = { email: 'a@b.com', password: 'secret' };
    const req = { ip: '127.0.0.1', headers: {}, socket: {} } as Request;
    const res = {} as Response;
    const expected = { access_token: 'token' };

    authService.signIn.mockResolvedValue(expected);

    const result = await controller.signIn(body, req, res);

    expect(loginRateLimit.assertAllowed).toHaveBeenCalledWith('127.0.0.1', 'a@b.com');
    expect(authService.signIn).toHaveBeenCalledWith('a@b.com', 'secret', res);
    expect(result).toEqual(expected);
  });

  it('calls refresh with the cookie token', async () => {
    const req = {
      cookies: { refresh_token: 'token' },
    } as Request & { cookies: { refresh_token: string } };
    const expected = { access_token: 'token' };

    authService.refresh.mockResolvedValue(expected);

    const result = await controller.refresh(req);

    expect(authService.refresh).toHaveBeenCalledWith(req.cookies?.refresh_token);
    expect(result).toEqual(expected);
  });

  it('calls logout with the res', async () => {
    const res = {} as Response;
    const expected = { message: 'Log out successful!' };

    authService.signOut.mockResolvedValue(expected);

    const result = await controller.logOut(res);

    expect(authService.signOut).toHaveBeenCalledWith(res);
    expect(result).toEqual(expected);
  });

  it('calls getMe with user id', async () => {
    const payload: JwtPayload = {
      sub: 1,
      username: 'John',
      isPlatformAdmin: false,
      roles: [],
    };
    const req = { user: payload } as Request;
    const expected = {
      id: 1,
      name: 'John',
      email: 'John@gmail.com',
      isPlatformAdmin: false,
      memberships: [],
    };

    authService.getMe.mockResolvedValue(expected);

    const result = await controller.me(req);

    expect(authService.getMe).toHaveBeenCalledWith(1);
    expect(result).toEqual(expected);
  });
});
