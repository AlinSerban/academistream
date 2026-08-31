import type { Job } from '@aws-sdk/client-mediaconvert';
import { parsePlaybackKeyFromJob } from './parse-playback-key';

describe('parsePlaybackKeyFromJob', () => {
    const job = {
        OutputGroupDetails: [{
            OutputDetails: [{
                OutputFilePaths: [
                    's3://test-bucket/tenants/10/videos/3/output/source.mp4',
                ],
            }],
        }],
    } as Job;

    it('strips bucket prefix from S3 output path', () => {
        expect(parsePlaybackKeyFromJob(job, 'test-bucket')).toBe(
            'tenants/10/videos/3/output/source.mp4',
        );
    });

    it('returns null when output path missing', () => {
        expect(parsePlaybackKeyFromJob({} as Job, 'test-bucket')).toBeNull();
    });
});
