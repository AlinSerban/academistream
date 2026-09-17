import { ConfigService } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { createStorageService } from "./create-storage-service";
import { createPlaybackUrlService, PlaybackUrlService } from "./playback-url.service";
import { LocalMediaController } from "./local-media.controller";
import { STORAGE } from "./storage.tokens";

export { STORAGE } from "./storage.tokens";

@Module({
    controllers: [LocalMediaController],
    providers: [
        {
            provide: STORAGE,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => createStorageService(config),
        },
        {
            provide: PlaybackUrlService,
            inject: [ConfigService, STORAGE],
            useFactory: (config: ConfigService, storage: ReturnType<typeof createStorageService>) =>
                createPlaybackUrlService(config, storage),
        },
    ],
    exports: [STORAGE, PlaybackUrlService],
})
export class StorageModule { }
