import {
    CreateJobCommand,
    MediaConvertClient,
} from '@aws-sdk/client-mediaconvert';
import { mediaConvertRegionalEndpoint } from './media-convert-endpoint';
import { buildMediaConvertJobSettings } from './media-convert-job-settings';

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
