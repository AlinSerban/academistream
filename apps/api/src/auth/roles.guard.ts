import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import { JwtPayload } from "./types";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);
        if (!required || required.length === 0) return true;

        const user = context.switchToHttp().getRequest().user as JwtPayload;

        if (required.includes('platform_admin'))
            if (user.isPlatformAdmin) return true;

        const hasRole = user.roles.some((m) => required.includes(m.role));
        if (!hasRole) throw new ForbiddenException();
        return true;
    }
}