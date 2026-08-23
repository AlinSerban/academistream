import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
    imports: [DbModule],
    providers: [CoursesService, VideosService],
    exports: [CoursesService, VideosService],
    controllers: [CoursesController, VideosController]
})

export class ContentModule { }
