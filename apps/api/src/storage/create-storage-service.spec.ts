import type { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local.storage';
import { S3StorageService } from './s3.storage';
import { createStorageService } from './create-storage-service';

function mockConfig(values: Record<string, string | undefined>): ConfigService {
    return {
        get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
}

describe('createStorageService', () => {
    it('defaults to local storage', () => {
        const service = createStorageService(mockConfig({}));
        expect(service).toBeInstanceOf(LocalStorageService);
    });

    it('selects S3 when configured', () => {
        const service = createStorageService(
            mockConfig({
                STORAGE_PROVIDER: 's3',
                S3_BUCKET: 'academistream-dev-media-123',
                AWS_REGION: 'eu-central-1',
            }),
        );
        expect(service).toBeInstanceOf(S3StorageService);
    });

    it('throws when S3 is selected without bucket or region', () => {
        expect(() =>
            createStorageService(
                mockConfig({
                    STORAGE_PROVIDER: 's3',
                    S3_BUCKET: 'bucket-only',
                }),
            ),
        ).toThrow('STORAGE_PROVIDER=s3 requires S3_BUCKET and AWS_REGION');
    });

    it('throws on unknown provider', () => {
        expect(() =>
            createStorageService(mockConfig({ STORAGE_PROVIDER: 'gcs' })),
        ).toThrow('Unknown STORAGE_PROVIDER: gcs');
    });
});
