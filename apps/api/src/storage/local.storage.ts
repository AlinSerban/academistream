import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PutObjectInput, StorageService } from './storage.types';

@Injectable()
export class LocalStorageService implements StorageService {
    constructor(private readonly rootDir: string) { }

    async putObject({ key, body, contentType }: PutObjectInput): Promise<{ key: string }> {
        void contentType; // used by future S3 PutObject
        const filePath = this.resolveSafePath(key);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, body);
        return { key };

        /*
         * Future S3 (do not enable yet):
         * await s3.send(new PutObjectCommand({
         *   Bucket: process.env.S3_BUCKET,
         *   Key: key,
         *   Body: body,
         *   ContentType: contentType,
         * }));
         * return { key };
         */
    }

    /**
     * Local stub of a CloudFront/S3 signed GET URL.
     * Real expiry/signing lands in S2-06.
     */
    async getSignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        void expiresInSeconds;
        const filePath = this.resolveSafePath(key);
        return pathToFileURL(filePath).href;

        /*
         * Future S3 / CloudFront (do not enable yet):
         * return getSignedUrl(
         *   s3,
         *   new GetObjectCommand({
         *     Bucket: process.env.S3_BUCKET,
         *     Key: key,
         *   }),
         *   { expiresIn: expiresInSeconds },
         * );
         */
    }

    private resolveSafePath(key: string): string {
        if (!key || key.includes('\0')) {
            throw new BadRequestException('Invalid storage key');
        }

        const root = path.resolve(this.rootDir);
        const resolved = path.resolve(root, key);

        const relative = path.relative(root, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new BadRequestException('Invalid storage key');
        }

        return resolved;
    }
}
