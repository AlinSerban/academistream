import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb } from "@academistream/db";

export const DRIZZLE = Symbol('DRIZZLE');

@Module({
    providers: [
        {
            provide: DRIZZLE,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const url = config.get<string>('DATABASE_URL');
                if (!url) {
                    throw new Error('DATABASE_URL is not set');
                }
                return createDb(url);
            }
        }
    ],
    exports: [DRIZZLE]
})
export class DbModule { }
