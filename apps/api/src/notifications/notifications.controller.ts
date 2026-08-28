import {
    Controller,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Query,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Get()
    list(@Req() req: Request, @Query('limit') limit?: string) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        const parsed = limit != null ? Number(limit) : 50
        return this.notificationsService.listForUser(
            tenantId,
            user.sub,
            Number.isFinite(parsed) ? parsed : 50,
        )
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Patch('read-all')
    markAllRead(@Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.notificationsService.markAllRead(tenantId, user.sub)
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Patch(':id/read')
    markRead(@Param('id') id: string, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.notificationsService.markRead(
            tenantId,
            user.sub,
            Number(id),
        )
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
