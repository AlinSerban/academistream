import {
    CancelJobCommand,
    CreateJobCommand,
    GetJobCommand,
    type Job,
    MediaConvertClient,
} from '@aws-sdk/client-mediaconvert';
import { mediaConvertRegionalEndpoint } from './media-convert-endpoint';
import { buildMediaConvertJobSettings } from './media-convert-job-settings';
import { parsePlaybackKeyFromJob } from './parse-playback-key';

export type MediaConvertJobState = 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'CANCELED' | 'ERROR';

/** Human-readable failure reason from a GetJob response (for logs). */
export function formatMediaConvertJobFailure(job: Job): string {
    const state = job.Status ?? 'UNKNOWN';
    const code = job.ErrorCode;
    const message = job.ErrorMessage?.trim();

    if (code != null && message) {
        return `MediaConvert job ${state} (${code}): ${message}`;
    }
    if (message) {
        return `MediaConvert job ${state}: ${message}`;
    }
    if (code != null) {
        return `MediaConvert job ${state} (${code})`;
    }
    return `MediaConvert job ${state}`;
}

export class MediaConvertService {
    private client: MediaConvertClient | null = null;

    constructor(
        private readonly region: string,
        private readonly roleArn: string,
        private readonly bucket: string,
        private readonly clientOverride?: MediaConvertClient,
    ) { }

    async submitTranscodeJob(inputKey: string, outputPrefix: string): Promise<string> {
        const client = await this.getClient();
        const result = await client.send(
            new CreateJobCommand({
                Role: this.roleArn,
                Settings: buildMediaConvertJobSettings(this.bucket, inputKey, outputPrefix),
            }),
        );

        const jobId = result.Job?.Id;
        if (!jobId) {
            throw new Error('MediaConvert CreateJob returned no job id');
        }

        return jobId;
    }

    async getJob(jobId: string): Promise<Job | undefined> {
        const client = await this.getClient();
        const result = await client.send(new GetJobCommand({ Id: jobId }));
        return result.Job;
    }

    async getJobState(jobId: string): Promise<MediaConvertJobState | undefined> {
        const job = await this.getJob(jobId);
        return job?.Status as MediaConvertJobState | undefined;
    }

    getPlaybackKeyFromJob(job: Job): string | null {
        return parsePlaybackKeyFromJob(job, this.bucket);
    }

    async getPlaybackKeyForJob(jobId: string): Promise<string | null> {
        const job = await this.getJob(jobId);
        if (!job) {
            return null;
        }
        return this.getPlaybackKeyFromJob(job);
    }

    async cancelJob(jobId: string): Promise<void> {
        if (!jobId)
            throw new Error('There is no job to cancel');

        const client = await this.getClient();
        await client.send(new CancelJobCommand({ Id: jobId }))

    }

    private async getClient(): Promise<MediaConvertClient> {
        if (this.clientOverride) {
            return this.clientOverride;
        }

        if (!this.client) {
            this.client = new MediaConvertClient({
                region: this.region,
                endpoint: mediaConvertRegionalEndpoint(this.region),
            });
        }

        return this.client;
    }
}
