import type { ConfigService } from '@nestjs/config';
import { MediaConvertService } from './media-convert.service';
import { resolveProcessingMode } from './resolve-processing-mode';

function mockConfig(values: Record<string, string | undefined>): ConfigService {
    return {
        get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
}

describe('resolveProcessingMode', () => {
    it('defaults to local processing', () => {
        expect(resolveProcessingMode(mockConfig({}))).toEqual({ kind: 'local' });
    });

    it('selects MediaConvert when STORAGE_PROVIDER=s3 and AWS vars set', () => {
        const mode = resolveProcessingMode(
            mockConfig({
                STORAGE_PROVIDER: 's3',
                S3_BUCKET: 'bucket',
                AWS_REGION: 'eu-central-1',
                MEDIACONVERT_ROLE: 'arn:aws:iam::123:role/mc',
            }),
        );

        expect(mode.kind).toBe('mediaconvert');
        if (mode.kind === 'mediaconvert') {
            expect(mode.mediaConvert).toBeInstanceOf(MediaConvertService);
        }
    });

    it('throws when s3 provider missing required env', () => {
        expect(() =>
            resolveProcessingMode(
                mockConfig({
                    STORAGE_PROVIDER: 's3',
                    S3_BUCKET: 'bucket-only',
                }),
            ),
        ).toThrow('STORAGE_PROVIDER=s3 requires S3_BUCKET, AWS_REGION, and MEDIACONVERT_ROLE');
    });
});
