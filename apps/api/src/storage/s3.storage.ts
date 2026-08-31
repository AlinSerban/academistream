import { Injectable } from '@nestjs/common';
import {
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PutObjectInput, StorageService } from './storage.types';
import { assertValidStorageKey } from './storage-key';

@Injectable()
export class S3StorageService implements StorageService {
    private readonly client: S3Client;

    constructor(
        private readonly bucket: string,
        region: string,
        client?: S3Client,
    ) {
        this.client = client ?? new S3Client({ region });
    }

    async putObject({ key, body, contentType }: PutObjectInput): Promise<{ key: string }> {
        assertValidStorageKey(key);

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }),
        );

        return { key };
    }

    async getSignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        assertValidStorageKey(key);

        return getSignedUrl(
            this.client,
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }),
            { expiresIn: expiresInSeconds },
        );
    }
}
