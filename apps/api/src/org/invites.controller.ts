import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Post,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../auth/public.decorator'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { InvitesService } from './invites.service'
import type { AcceptInviteInput, CreateInviteInput } from './types'

@Controller('invites')
export class InvitesController {
    constructor(private readonly invitesService: InvitesService) { }

    @Roles('tenant_admin')
    @Get()
    list(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.invitesService.listPending(tenantId)
    }

    @Roles('tenant_admin')
    @Post()
    create(@Body() body: CreateInviteInput, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.invitesService.create(tenantId, user.sub, body)
    }

    @Public()
    @Post('accept')
    accept(@Body() body: AcceptInviteInput) {
        return this.invitesService.accept(body)
    }

    @Roles('tenant_admin')
    @Delete(':id')
    revoke(@Param('id') id: string, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.invitesService.revoke(Number(id), tenantId, user.sub)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
