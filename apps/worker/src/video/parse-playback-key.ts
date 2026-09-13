import type { Job } from '@aws-sdk/client-mediaconvert';

/** GetJob may still return OutputFilePaths at runtime; newer SDK types omit it. */
type OutputDetailWithPaths = {
    OutputFilePaths?: string[];
};

/** Extract S3 object key from MediaConvert output file path (s3://bucket/key). */
export function parsePlaybackKeyFromJob(job: Job, bucket: string): string | null {
    const outputDetail = job.OutputGroupDetails?.[0]?.OutputDetails?.[0] as
        | OutputDetailWithPaths
        | undefined;
    const filePath = outputDetail?.OutputFilePaths?.[0] ?? deriveOutputPathFromSettings(job);

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

/** Fallback when GetJob omits OutputFilePaths: destination prefix + input basename. */
function deriveOutputPathFromSettings(job: Job): string | null {
    const destination =
        job.Settings?.OutputGroups?.[0]?.OutputGroupSettings?.FileGroupSettings?.Destination;
    const fileInput = job.Settings?.Inputs?.[0]?.FileInput;
    if (!destination || !fileInput) {
        return null;
    }

    const basename = fileInput.split('/').pop();
    if (!basename) {
        return null;
    }

    const destMatch = destination.match(/^s3:\/\/[^/]+\/(.*)$/);
    if (!destMatch) {
        return null;
    }

    const prefix = destMatch[1].replace(/\/?$/, '/');
    return `s3://${destination.match(/^s3:\/\/([^/]+)/)?.[1]}/${prefix}${basename}`;
}
