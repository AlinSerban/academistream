import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Post,
    Query,
    Req,
} from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/roles.decorator'
import type { JwtPayload } from '../auth/types'
import { AssignmentsService } from './assignments.service'
import type { CreateAssignmentInput } from './types'
import { parsePageQuery } from '../common/pagination'

@Controller('assignments')
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Roles('tenant_admin', 'instructor')
    @Get()
    listAll(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.assignmentsService.listForTenant(
            tenantId,
            parsePageQuery(page, pageSize),
        )
    }

    @Roles('tenant_admin', 'instructor')
    @Get('learners')
    listLearners(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.assignmentsService.listLearners(
            tenantId,
            parsePageQuery(page, pageSize, { pageSize: 50 }),
        )
    }

    @Roles('tenant_admin', 'instructor', 'learner')
    @Get('mine')
    listMine(
        @Req() req: Request,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.assignmentsService.listMine(
            tenantId,
            user.sub,
            parsePageQuery(page, pageSize),
        )
    }

    @Roles('tenant_admin', 'instructor')
    @Post()
    create(@Body() body: CreateAssignmentInput, @Req() req: Request) {
        const user = req.user as JwtPayload
        const tenantId = this.getTenantId(user)
        return this.assignmentsService.create(tenantId, user.sub, body)
    }

    @Roles('tenant_admin', 'instructor')
    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.assignmentsService.delete(Number(id), tenantId)
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId
        if (tenantId == null) throw new ForbiddenException()
        return tenantId
    }
}
