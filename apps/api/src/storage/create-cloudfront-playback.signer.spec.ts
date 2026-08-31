import type { ConfigService } from '@nestjs/config';
import { createCloudFrontPlaybackSigner } from './create-cloudfront-playback.signer';
import { CloudFrontPlaybackSigner } from './cloudfront-playback.signer';

describe('createCloudFrontPlaybackSigner', () => {
    it('returns null when CloudFront env is unset', () => {
        const config = {
            get: jest.fn().mockReturnValue(undefined),
        } as unknown as ConfigService;

        expect(createCloudFrontPlaybackSigner(config)).toBeNull();
    });

    it('throws when CloudFront env is partially set', () => {
        const config = {
            get: jest.fn((key: string) => {
                if (key === 'CLOUDFRONT_DOMAIN') return 'd123.cloudfront.net';
                return undefined;
            }),
        } as unknown as ConfigService;

        expect(() => createCloudFrontPlaybackSigner(config)).toThrow(
            'CloudFront playback requires CLOUDFRONT_DOMAIN',
        );
    });
});

describe('createCloudFrontPlaybackSigner with key file', () => {
    const keyPath = 'apps/api/src/storage/test-fixtures/cloudfront-private-key.pem';

    it('loads signer from private key path', () => {
        const config = {
            get: jest.fn((key: string) => {
                const values: Record<string, string> = {
                    CLOUDFRONT_DOMAIN: 'd123.cloudfront.net',
                    CLOUDFRONT_KEY_PAIR_ID: 'APKATEST',
                    CLOUDFRONT_PRIVATE_KEY_PATH: keyPath,
                };
                return values[key];
            }),
        } as unknown as ConfigService;

        const signer = createCloudFrontPlaybackSigner(config);
        expect(signer).toBeInstanceOf(CloudFrontPlaybackSigner);
    });
});
