import { Body, Controller, ForbiddenException, Post, Get, Req, Patch, Param, Delete } from "@nestjs/common"
import { CoursesService } from "./courses.service"
import type { JwtPayload } from "../auth/types"
import type { Request } from "express"
import type { CreateCourseInput } from "./types"
import { Roles } from "../auth/roles.decorator"

@Roles('tenant_admin', 'instructor')
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    @Get()
    readAll(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.coursesService.listAll(tenantId);
    }

    @Get(':id')
    read(@Param('id') courseId: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.coursesService.getCourseById(Number(courseId), tenantId);
    }

    @Post('create')
    create(@Body() body: CreateCourseInput, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.coursesService.create(tenantId, body);

    }

    @Patch(':id')
    update(@Param('id') courseId: string, @Body() body: CreateCourseInput, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload)
        return this.coursesService.update(Number(courseId), body, tenantId);

    }

    @Delete(':id')
    delete(@Param('id') courseId: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.coursesService.deleteCourse(Number(courseId), tenantId);
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId;
        if (tenantId == null) throw new ForbiddenException();
        return tenantId;
    }

}