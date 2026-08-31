import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

/** Signs CloudFront URLs for private S3 origins (OAC/OAI configured on distribution). */
export class CloudFrontPlaybackSigner {
    constructor(
        private readonly domain: string,
        private readonly keyPairId: string,
        private readonly privateKey: string,
    ) {}

    sign(objectKey: string, expiresInSeconds: number): string {
        const normalizedKey = objectKey.replace(/^\/+/, '');
        const url = `https://${this.domain}/${normalizedKey}`;
        const expires = new Date(Date.now() + expiresInSeconds * 1000);

        return getSignedUrl({
            url,
            keyPairId: this.keyPairId,
            privateKey: this.privateKey,
            dateLessThan: expires.toISOString(),
        });
    }
}
