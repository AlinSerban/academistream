import type { StorageService } from './storage.types';
import { CloudFrontPlaybackSigner } from './cloudfront-playback.signer';
import { PlaybackUrlService } from './playback-url.service';

describe('PlaybackUrlService', () => {
    const storage: StorageService = {
        putObject: jest.fn(),
        getSignedGetUrl: jest.fn().mockResolvedValue('https://s3.example/signed'),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (storage.getSignedGetUrl as jest.Mock).mockResolvedValue('https://s3.example/signed');
    });

    it('uses storage presigned URL when CloudFront is not configured', async () => {
        const service = new PlaybackUrlService(storage, null);

        await expect(service.getSignedGetUrl('tenants/1/videos/2/output/a.mp4')).resolves.toBe(
            'https://s3.example/signed',
        );
        expect(storage.getSignedGetUrl).toHaveBeenCalledWith(
            'tenants/1/videos/2/output/a.mp4',
            3600,
        );
    });

    it('uses CloudFront signer when configured', async () => {
        const cloudFront = {
            sign: jest.fn().mockReturnValue('https://d123.cloudfront.net/signed'),
        } as unknown as CloudFrontPlaybackSigner;

        const service = new PlaybackUrlService(storage, cloudFront);

        await expect(service.getSignedGetUrl('tenants/1/videos/2/output/a.mp4', 900)).resolves.toBe(
            'https://d123.cloudfront.net/signed',
        );
        expect(cloudFront.sign).toHaveBeenCalledWith('tenants/1/videos/2/output/a.mp4', 900);
        expect(storage.getSignedGetUrl).not.toHaveBeenCalled();
    });
});
