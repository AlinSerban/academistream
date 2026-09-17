import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PutObjectInput, StorageService } from './storage.types';
import { assertValidStorageKey } from './storage-key';
import { signLocalMediaUrl } from './local-media-url';

export type LocalStorageOptions = {
    /** Public site origin (e.g. https://academistream.online). Enables browser-playable URLs. */
    publicBaseUrl?: string
    /** HMAC secret for /api/local-media query signatures (typically JWT_SECRET). */
    signingSecret?: string
}

@Injectable()
export class LocalStorageService implements StorageService {
    constructor(
        private readonly rootDir: string,
        private readonly options: LocalStorageOptions = {},
    ) { }

    async putObject({ key, body, contentType }: PutObjectInput): Promise<{ key: string }> {
        void contentType;
        const filePath = this.resolveSafePath(key);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, body);
        return { key };
    }

    /**
     * Browser-playable HTTPS URL when WEB_ORIGIN + JWT_SECRET are set;
     * otherwise a file:// URL (tests / non-browser tooling).
     */
    async getSignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        assertValidStorageKey(key);
        // Ensure key stays under the storage root (rejects traversal).
        this.resolveSafePath(key);

        const base = this.options.publicBaseUrl?.trim()
        const secret = this.options.signingSecret?.trim()
        if (base && secret) {
            return signLocalMediaUrl({
                baseUrl: base,
                key,
                expiresInSeconds,
                secret,
            })
        }

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

    /** Absolute filesystem path for a validated storage key. */
    resolvePath(key: string): string {
        return this.resolveSafePath(key)
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
