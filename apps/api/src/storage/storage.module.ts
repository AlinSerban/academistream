import { ConfigService } from "@nestjs/config";
import { LocalStorageService } from "./local.storage";
import { Module } from "@nestjs/common";
import { resolveStorageRoot } from "./resolve-storage-root";

export const STORAGE = Symbol('STORAGE');

@Module({
    providers: [{
        provide: STORAGE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
            const root = resolveStorageRoot(config.get<string>('STORAGE_LOCAL_ROOT'));
            return new LocalStorageService(root);
        },
    }],
    exports: [STORAGE],
})
export class StorageModule { }
