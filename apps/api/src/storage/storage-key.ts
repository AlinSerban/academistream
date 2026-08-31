import { BadRequestException } from '@nestjs/common';

/** Reject traversal and other unsafe object keys (local paths and S3 keys). */
export function assertValidStorageKey(key: string): void {
    if (!key || key.includes('\0')) {
        throw new BadRequestException('Invalid storage key');
    }

    if (key.startsWith('/') || key.includes('..')) {
        throw new BadRequestException('Invalid storage key');
    }
}
