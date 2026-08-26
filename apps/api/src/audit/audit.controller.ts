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

@Controller('audit-events')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Roles('tenant_admin', 'instructor')
    @Get()
    list(@Req() req: Request, @Query('limit') limit?: string) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        const parsed = limit != null ? Number(limit) : 100
        return this.auditService.listForTenant(
            tenantId,
            Number.isFinite(parsed) ? parsed : 100,
        )
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
