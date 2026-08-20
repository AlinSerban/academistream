import { Body, Controller, ForbiddenException, Get, Post, Req } from "@nestjs/common"
import { TenantsService } from "./tenants.service"
import { Roles } from "../auth/roles.decorator"
import type { CreateTenantInput } from "./types"
import type { Request } from "express"
import type { JwtPayload } from "../auth/types"

@Controller('tenants')
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) { }

    @Post('register')
    @Roles('platform_admin')
    create(@Body() body: CreateTenantInput) {
        return this.tenantsService.create(body);
    }

    @Get('me')
    me(@Req() req: Request) {
        const user = req.user as JwtPayload;
        const tenantId = user.roles[0]?.tenantId;

        if (tenantId == null) {
            throw new ForbiddenException();
        }

        return this.tenantsService.getMe(tenantId);
    }
}