import { BadRequestException } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageService } from './s3.storage';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn(),
}));

describe('S3StorageService', () => {
    const send = jest.fn();
    const client = { send } as unknown as ConstructorParameters<typeof S3StorageService>[2];
    const service = new S3StorageService('test-bucket', 'eu-central-1', client);

    beforeEach(() => {
        send.mockReset();
        jest.mocked(getSignedUrl).mockReset();
    });

    it('putObject uploads with tenant-scoped key', async () => {
        send.mockResolvedValue({});
        const body = Buffer.from('video');

        await expect(
            service.putObject({
                key: 'tenants/10/videos/3/source.mp4',
                body,
                contentType: 'video/mp4',
            }),
        ).resolves.toEqual({ key: 'tenants/10/videos/3/source.mp4' });

        expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
        const command = send.mock.calls[0][0] as PutObjectCommand;
        expect(command.input).toEqual({
            Bucket: 'test-bucket',
            Key: 'tenants/10/videos/3/source.mp4',
            Body: body,
            ContentType: 'video/mp4',
        });
    });

    it('putObject rejects unsafe keys', async () => {
        await expect(
            service.putObject({
                key: '../escape.mp4',
                body: Buffer.from('x'),
            }),
        ).rejects.toThrow(BadRequestException);
        expect(send).not.toHaveBeenCalled();
    });

    it('getSignedGetUrl returns presigned URL', async () => {
        jest.mocked(getSignedUrl).mockResolvedValue('https://s3.example/signed');

        await expect(
            service.getSignedGetUrl('tenants/10/videos/3/source.mp4', 900),
        ).resolves.toBe('https://s3.example/signed');

        expect(getSignedUrl).toHaveBeenCalledWith(
            client,
            expect.any(GetObjectCommand),
            { expiresIn: 900 },
        );
        const command = jest.mocked(getSignedUrl).mock.calls[0][1] as GetObjectCommand;
        expect(command.input).toEqual({
            Bucket: 'test-bucket',
            Key: 'tenants/10/videos/3/source.mp4',
        });
    });
});
