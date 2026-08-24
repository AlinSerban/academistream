// storage.types.ts
export interface PutObjectInput {
    key: string;           // e.g. "tenants/1/videos/42/source.mp4"
    body: Buffer;          // or Readable later
    contentType?: string;
}

export interface StorageService {
    putObject(input: PutObjectInput): Promise<{ key: string }>;
    getSignedGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
}