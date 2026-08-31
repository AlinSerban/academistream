import type { ConfigService } from '@nestjs/config';
import { createCloudFrontPlaybackSigner } from './create-cloudfront-playback.signer';
import type { CloudFrontPlaybackSigner } from './cloudfront-playback.signer';
import type { StorageService } from './storage.types';

export class PlaybackUrlService {
    constructor(
        private readonly storage: StorageService,
        private readonly cloudFront: CloudFrontPlaybackSigner | null,
    ) {}

    async getSignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        if (this.cloudFront) {
            return this.cloudFront.sign(key, expiresInSeconds);
        }
        return this.storage.getSignedGetUrl(key, expiresInSeconds);
    }
}

export function createPlaybackUrlService(
    config: ConfigService,
    storage: StorageService,
): PlaybackUrlService {
    const cloudFront = createCloudFrontPlaybackSigner(config);
    return new PlaybackUrlService(storage, cloudFront);
}
