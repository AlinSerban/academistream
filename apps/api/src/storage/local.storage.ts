import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PutObjectInput, StorageService } from './storage.types';
import { assertValidStorageKey } from './storage-key';

@Injectable()
export class LocalStorageService implements StorageService {
    constructor(private readonly rootDir: string) { }

    async putObject({ key, body, contentType }: PutObjectInput): Promise<{ key: string }> {
        void contentType;
        const filePath = this.resolveSafePath(key);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, body);
        return { key };
    }

    /** Local file URL (CloudFront signing is used only on the S3/CloudFront path). */
    async getSignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        void expiresInSeconds;
        const filePath = this.resolveSafePath(key);
        return pathToFileURL(filePath).href;
    }

    async deleteObject(key: string): Promise<void> {
        assertValidStorageKey(key);

        try {
            const filePath = this.resolveSafePath(key);
            await unlink(filePath);
        }
        catch (err) {
            if (err && typeof err === 'object' && 'code' in err && err.code == 'ENOENT')
                return;
            throw err;
        }
    }

    private resolveSafePath(key: string): string {
        assertValidStorageKey(key);

        const root = path.resolve(this.rootDir);
        const resolved = path.resolve(root, key);

        const relative = path.relative(root, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new BadRequestException('Invalid storage key');
        }

        return resolved;
    }
}
