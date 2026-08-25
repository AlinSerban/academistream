import dotenv from 'dotenv';
import path from 'path';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
    out: './drizzle',
    schema: '../../packages/db/src/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});