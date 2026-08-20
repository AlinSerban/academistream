import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { signIn: jest.Mock, refresh: jest.Mock, signOut: jest.Mock, getMe: jest.Mock };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      refresh: jest.fn(),
      signOut: jest.fn(),
      getMe: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('calls signIn with email, password and res', async () => {
    const body = { email: 'a@b.com', password: 'secret' };
    const res = {} as Response;
    const expected = { access_token: 'token' };

    authService.signIn.mockResolvedValue(expected);

    const result = await controller.signIn(body, res);

    expect(authService.signIn).toHaveBeenCalledWith('a@b.com', 'secret', res);
    expect(result).toEqual(expected);
  });

  it('calls refresh with the cookie token', async () => {
    const req = { cookies: { refresh_token: 'token' } } as unknown as Request;
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
    const req = { user: { sub: 1, username: 'John' } } as unknown as Request;
    const user = req.user as { sub: number, username: string }
    const expected = {
      id: user.sub,
      name: user.username,
      email: 'John@gmail.com',
      isPlatformAdmin: 'true',
      memberships: {}
    }

    authService.getMe.mockResolvedValue(expected);

    const result = await controller.me(req);

    expect(authService.getMe).toHaveBeenCalledWith(user.sub);
    expect(result).toEqual(expected);

  });



});
