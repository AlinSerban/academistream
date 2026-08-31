import type { ConfigService } from '@nestjs/config';
import { MediaConvertService } from './media-convert.service';

export type ProcessingMode =
    | { kind: 'local' }
    | { kind: 'mediaconvert'; mediaConvert: MediaConvertService };

export function resolveProcessingMode(config: ConfigService): ProcessingMode {
    const provider = (config.get<string>('STORAGE_PROVIDER') ?? 'local').trim().toLowerCase();

    if (provider !== 's3') {
        return { kind: 'local' };
    }

    const bucket = config.get<string>('S3_BUCKET')?.trim();
    const region = config.get<string>('AWS_REGION')?.trim();
    const roleArn = config.get<string>('MEDIACONVERT_ROLE')?.trim();

    if (!bucket || !region || !roleArn) {
        throw new Error(
            'STORAGE_PROVIDER=s3 requires S3_BUCKET, AWS_REGION, and MEDIACONVERT_ROLE',
        );
    }

    return {
        kind: 'mediaconvert',
        mediaConvert: new MediaConvertService(region, roleArn, bucket),
    };
}
