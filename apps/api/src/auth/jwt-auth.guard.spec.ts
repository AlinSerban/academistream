import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  function createContext(): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;
  }

  it('allows public routes without JWT', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = createContext();

    expect(guard.canActivate(ctx)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('requires JWT for non-public routes (e.g. playback)', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createContext();
    const spy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(false);

    expect(guard.canActivate(ctx)).toBe(false);
    expect(spy).toHaveBeenCalledWith(ctx);

    spy.mockRestore();
  });
});
