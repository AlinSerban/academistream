import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Req,
} from "@nestjs/common"
import { VideosService } from "./videos.service"
import type { JwtPayload } from "../auth/types"
import type { Request } from "express"
import type { CreateVideoInput, PublishVideoInput, UpdateVideoInput } from "./types"
import { Roles } from "../auth/roles.decorator"

@Roles('tenant_admin', 'instructor')
@Controller('videos')
export class VideosController {
    constructor(private readonly videosService: VideosService) { }

    @Get()
    readAll(@Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.listAll(tenantId);
    }

    @Get('by-course/:courseId')
    readByCourse(@Param('courseId') courseId: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.listByCourse(Number(courseId), tenantId);
    }

    @Get(':id')
    read(@Param('id') videoId: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.getVideoById(Number(videoId), tenantId);
    }

    @Post('create')
    create(@Body() body: CreateVideoInput, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.create(tenantId, body);
    }

    @Patch(':id/publish')
    publish(
        @Param('id') videoId: string,
        @Body() body: PublishVideoInput,
        @Req() req: Request,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.publish(Number(videoId), tenantId, body.publishState);
    }

    @Patch(':id')
    update(
        @Param('id') videoId: string,
        @Body() body: UpdateVideoInput,
        @Req() req: Request,
    ) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.update(Number(videoId), body, tenantId);
    }

    @Delete(':id')
    delete(@Param('id') videoId: string, @Req() req: Request) {
        const tenantId = this.getTenantId(req.user as JwtPayload);
        return this.videosService.deleteVideo(Number(videoId), tenantId);
    }

    private getTenantId(user: JwtPayload) {
        const tenantId = user.roles[0]?.tenantId;
        if (tenantId == null) throw new ForbiddenException();
        return tenantId;
    }
}
