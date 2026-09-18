import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Put,
    Query,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { ProgressService } from './progress.service'
import type { UpsertProgressInput } from './types'
import { parsePageQuery } from '../common/pagination'

@Controller()
export class ProgressController {
    constructor(private readonly progressService: ProgressService) { }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Put('progress')
    upsert(@Body() body: UpsertProgressInput, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        const role = user.roles[0]?.role
        if (role == null) throw new ForbiddenException()
        return this.progressService.upsertMine(tenantId, user.sub, body, role)
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Get('progress/mine')
    listMine(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.progressService.listMine(
            tenantId,
            user.sub,
            parsePageQuery(page, pageSize),
        )
    }

    @Roles('tenant_admin', 'instructor')
    @Get('progress')
    listAll(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.progressService.listForTenant(
            tenantId,
            parsePageQuery(page, pageSize),
        )
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Get('completions/mine')
    listCompletionsMine(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.progressService.listCompletionsMine(
            tenantId,
            user.sub,
            parsePageQuery(page, pageSize),
        )
    }

    @Roles('tenant_admin', 'instructor')
    @Get('completions')
    listCompletions(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.progressService.listCompletionsForTenant(
            tenantId,
            parsePageQuery(page, pageSize),
        )
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
