import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { CloudFrontPlaybackSigner } from './cloudfront-playback.signer';

jest.mock('@aws-sdk/cloudfront-signer', () => ({
    getSignedUrl: jest.fn(),
}));

describe('CloudFrontPlaybackSigner', () => {
    const signer = new CloudFrontPlaybackSigner(
        'd111111abcdef8.cloudfront.net',
        'APKAI...',
        '-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----',
    );

    beforeEach(() => {
        jest.mocked(getSignedUrl).mockReset();
        jest.mocked(getSignedUrl).mockReturnValue('https://signed.cloudfront.test/video');
    });

    it('signs URL for object key under distribution domain', () => {
        const url = signer.sign('tenants/1/videos/2/output/file.mp4', 3600);

        expect(url).toBe('https://signed.cloudfront.test/video');
        expect(getSignedUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://d111111abcdef8.cloudfront.net/tenants/1/videos/2/output/file.mp4',
                keyPairId: 'APKAI...',
            }),
        );
    });
});
