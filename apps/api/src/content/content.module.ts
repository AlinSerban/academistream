import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";
import { StorageModule } from "../storage/storage.module";
import { KafkaModule } from "../kafka/kafka.module";
import { AuditModule } from "../audit/audit.module";

@Module({
    imports: [DbModule, StorageModule, KafkaModule, AuditModule],
    providers: [CoursesService, VideosService],
    exports: [CoursesService, VideosService],
    controllers: [CoursesController, VideosController]
})

export class ContentModule { }
