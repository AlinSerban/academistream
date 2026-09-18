import {
    Controller,
    ForbiddenException,
    Get,
    Query,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { AuditService } from './audit.service'
import { parsePageQuery } from '../common/pagination'

@Controller('audit-events')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Roles('tenant_admin', 'instructor')
    @Get()
    list(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.auditService.listForTenant(
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
