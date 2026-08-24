import { ConfigService } from "@nestjs/config";
import { LocalStorageService } from "./local.storage";
import { Module } from "@nestjs/common";

// storage.module.ts
export const STORAGE = Symbol('STORAGE');

@Module({
    providers: [{
        provide: STORAGE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
            const root = config.get<string>('STORAGE_LOCAL_ROOT') ?? './.data/media';
            return new LocalStorageService(root);
        },
    }],
    exports: [STORAGE],
})
export class StorageModule { }