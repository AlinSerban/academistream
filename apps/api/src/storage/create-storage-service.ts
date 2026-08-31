import type { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local.storage';
import { S3StorageService } from './s3.storage';
import { resolveStorageRoot } from './resolve-storage-root';
import type { StorageService } from './storage.types';

export function createStorageService(config: ConfigService): StorageService {
    const provider = (config.get<string>('STORAGE_PROVIDER') ?? 'local').trim().toLowerCase();

    if (provider === 's3') {
        const bucket = config.get<string>('S3_BUCKET')?.trim();
        const region = config.get<string>('AWS_REGION')?.trim();
        if (!bucket || !region) {
            throw new Error('STORAGE_PROVIDER=s3 requires S3_BUCKET and AWS_REGION');
        }
        return new S3StorageService(bucket, region);
    }

    if (provider !== 'local') {
        throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
    }

    const root = resolveStorageRoot(config.get<string>('STORAGE_LOCAL_ROOT'));
    return new LocalStorageService(root);
}
