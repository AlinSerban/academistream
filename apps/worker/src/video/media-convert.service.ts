import {
    CreateJobCommand,
    GetJobCommand,
    type Job,
    MediaConvertClient,
} from '@aws-sdk/client-mediaconvert';
import { mediaConvertRegionalEndpoint } from './media-convert-endpoint';
import { buildMediaConvertJobSettings } from './media-convert-job-settings';
import { parsePlaybackKeyFromJob } from './parse-playback-key';

export type MediaConvertJobState = 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'CANCELED' | 'ERROR';

export class MediaConvertService {
    private client: MediaConvertClient | null = null;

    constructor(
        private readonly region: string,
        private readonly roleArn: string,
        private readonly bucket: string,
        private readonly clientOverride?: MediaConvertClient,
    ) {}

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

    async getPlaybackKeyForJob(jobId: string): Promise<string | null> {
        const job = await this.getJob(jobId);
        if (!job) {
            return null;
        }
        return parsePlaybackKeyFromJob(job, this.bucket);
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
