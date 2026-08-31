import { ConfigService } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { createStorageService } from "./create-storage-service";

export const STORAGE = Symbol('STORAGE');

@Module({
    providers: [{
        provide: STORAGE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => createStorageService(config),
    }],
    exports: [STORAGE],
})
export class StorageModule { }
