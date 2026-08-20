import { Body, Controller, Post } from "@nestjs/common"
import { TenantsService } from "./tenants.service"
import { Roles } from "../auth/roles.decorator"
import type { CreateTenantInput } from "./types"

@Controller('tenants')
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) { }

    @Post('register')
    @Roles('platform_admin')
    create(@Body() body: CreateTenantInput) {
        return this.tenantsService.create(body);
    }
}