import {
    Controller,
    ForbiddenException,
    Get,
    Header,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { CompletionsExportService } from './completions-export.service'

@Controller('exports')
export class ExportsController {
    constructor(private readonly exportService: CompletionsExportService) { }

    /** Tenant admin CSV of completions (E07). */
    @Roles('tenant_admin')
    @Get('completions.csv')
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header(
        'Content-Disposition',
        'attachment; filename="completions.csv"',
    )
    async completionsCsv(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.exportService.toCsv(tenantId)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
