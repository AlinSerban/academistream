import type { Job } from '@aws-sdk/client-mediaconvert';

/** Extract S3 object key from MediaConvert output file path (s3://bucket/key). */
export function parsePlaybackKeyFromJob(job: Job, bucket: string): string | null {
    const filePath = job.OutputGroupDetails?.[0]?.OutputDetails?.[0]?.OutputFilePaths?.[0];
    if (!filePath) {
        return null;
    }

    const bucketPrefix = `s3://${bucket}/`;
    if (filePath.startsWith(bucketPrefix)) {
        return filePath.slice(bucketPrefix.length);
    }

    const match = filePath.match(/^s3:\/\/[^/]+\/(.*)$/);
    return match?.[1] ?? null;
}
