import { readFileSync } from 'fs';
import path from 'path';
import type { ConfigService } from '@nestjs/config';
import { CloudFrontPlaybackSigner } from './cloudfront-playback.signer';
import { resolveMonorepoRoot } from './resolve-storage-root';

export function createCloudFrontPlaybackSigner(
    config: ConfigService,
): CloudFrontPlaybackSigner | null {
    const domain = config.get<string>('CLOUDFRONT_DOMAIN')?.trim();
    const keyPairId = config.get<string>('CLOUDFRONT_KEY_PAIR_ID')?.trim();
    const keyPath = config.get<string>('CLOUDFRONT_PRIVATE_KEY_PATH')?.trim();

    if (!domain && !keyPairId && !keyPath) {
        return null;
    }

    if (!domain || !keyPairId || !keyPath) {
        throw new Error(
            'CloudFront playback requires CLOUDFRONT_DOMAIN, CLOUDFRONT_KEY_PAIR_ID, and CLOUDFRONT_PRIVATE_KEY_PATH',
        );
    }

    const resolvedPath = path.isAbsolute(keyPath)
        ? path.normalize(keyPath)
        : path.resolve(resolveMonorepoRoot(), keyPath);

    const privateKey = readFileSync(resolvedPath, 'utf8');

    return new CloudFrontPlaybackSigner(domain, keyPairId, privateKey);
}
