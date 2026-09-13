import {
    buildMediaConvertJobSettings,
    MEDIACONVERT_AUDIO_SELECTOR,
} from './media-convert-job-settings';

describe('buildMediaConvertJobSettings', () => {
    it('targets tenant-scoped S3 input and MP4 file output', () => {
        const settings = buildMediaConvertJobSettings(
            'test-bucket',
            'tenants/10/videos/3/source.mp4',
            'tenants/10/videos/3/output',
        );

        expect(settings.Inputs?.[0]?.FileInput).toBe(
            's3://test-bucket/tenants/10/videos/3/source.mp4',
        );
        expect(
            settings.OutputGroups?.[0]?.OutputGroupSettings?.FileGroupSettings?.Destination,
        ).toBe('s3://test-bucket/tenants/10/videos/3/output/');
        expect(settings.OutputGroups?.[0]?.Outputs?.[0]?.ContainerSettings?.Container).toBe('MP4');
        expect(settings.Inputs?.[0]?.AudioSelectors?.[MEDIACONVERT_AUDIO_SELECTOR]).toEqual({
            DefaultSelection: 'DEFAULT',
        });
        expect(
            settings.OutputGroups?.[0]?.Outputs?.[0]?.AudioDescriptions?.[0]?.AudioSourceName,
        ).toBe(MEDIACONVERT_AUDIO_SELECTOR);
    });
});
