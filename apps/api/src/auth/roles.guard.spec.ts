import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import type { JwtPayload } from './types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const platformAdmin: JwtPayload = {
    sub: 1,
    username: 'Platform',
    isPlatformAdmin: true,
    roles: [],
  };

  const tenantAdmin: JwtPayload = {
    sub: 2,
    username: 'Acme Admin',
    isPlatformAdmin: false,
    roles: [{ tenantId: 10, role: 'tenant_admin' }],
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function createContext(user: JwtPayload): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('allows when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(createContext(tenantAdmin))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('allows platform admin when platform_admin is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform_admin']);
    expect(guard.canActivate(createContext(platformAdmin))).toBe(true);
  });

  it('forbids tenant admin when platform_admin is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['platform_admin']);
    expect(() => guard.canActivate(createContext(tenantAdmin))).toThrow(
      ForbiddenException,
    );
  });

  it('allows tenant admin when tenant_admin is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['tenant_admin']);
    expect(guard.canActivate(createContext(tenantAdmin))).toBe(true);
  });

  it('forbids platform admin without tenant role when tenant_admin is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['tenant_admin']);
    expect(() => guard.canActivate(createContext(platformAdmin))).toThrow(
      ForbiddenException,
    );
  });
});
