import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Put,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { ProgressService } from './progress.service'
import type { UpsertProgressInput } from './types'

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
    listMine(@Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.progressService.listMine(tenantId, user.sub)
    }

    @Roles('tenant_admin', 'instructor')
    @Get('progress')
    listAll(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.progressService.listForTenant(tenantId)
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Get('completions/mine')
    listCompletionsMine(@Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.progressService.listCompletionsMine(tenantId, user.sub)
    }

    @Roles('tenant_admin', 'instructor')
    @Get('completions')
    listCompletions(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.progressService.listCompletionsForTenant(tenantId)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
