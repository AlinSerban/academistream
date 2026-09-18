import {
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Query,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { MembersService } from './members.service'
import { parsePageQuery } from '../common/pagination'

@Controller('members')
export class MembersController {
    constructor(private readonly membersService: MembersService) { }

    @Roles('tenant_admin')
    @Get()
    list(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.membersService.list(tenantId, parsePageQuery(page, pageSize))
    }

    @Roles('tenant_admin')
    @Delete(':userId')
    remove(@Param('userId') userId: string, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.membersService.remove(tenantId, Number(userId), user.sub)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
