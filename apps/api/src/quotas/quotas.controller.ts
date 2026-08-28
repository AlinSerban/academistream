import { Controller, ForbiddenException, Get, Req } from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { QuotasService } from './quotas.service'

@Controller('quotas')
export class QuotasController {
    constructor(private readonly quotasService: QuotasService) { }

    @Roles('tenant_admin', 'instructor')
    @Get('usage')
    usage(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.quotasService.getStatusForTenant(tenantId)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
