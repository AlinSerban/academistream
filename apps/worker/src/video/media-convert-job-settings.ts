import type { JobSettings } from '@aws-sdk/client-mediaconvert';

/** Input audio selector name — must match AudioDescriptions.AudioSourceName. */
export const MEDIACONVERT_AUDIO_SELECTOR = 'Audio Selector 1';

/** MediaConvert job settings: one MP4 output under the given S3 prefix (no bucket in prefix). */
export function buildMediaConvertJobSettings(
    bucket: string,
    inputKey: string,
    outputPrefix: string,
): JobSettings {
    const normalizedPrefix = outputPrefix.endsWith('/') ? outputPrefix : `${outputPrefix}/`;

    return {
        Inputs: [{
            FileInput: `s3://${bucket}/${inputKey}`,
            AudioSelectors: {
                [MEDIACONVERT_AUDIO_SELECTOR]: {
                    DefaultSelection: 'DEFAULT',
                },
            },
        }],
        OutputGroups: [{
            Name: 'File Group',
            OutputGroupSettings: {
                Type: 'FILE_GROUP_SETTINGS',
                FileGroupSettings: {
                    Destination: `s3://${bucket}/${normalizedPrefix}`,
                },
            },
            Outputs: [{
                ContainerSettings: { Container: 'MP4' },
                VideoDescription: {
                    CodecSettings: {
                        Codec: 'H_264',
                        H264Settings: {
                            Bitrate: 2500000,
                            RateControlMode: 'CBR',
                        },
                    },
                },
                AudioDescriptions: [{
                    AudioSourceName: MEDIACONVERT_AUDIO_SELECTOR,
                    CodecSettings: {
                        Codec: 'AAC',
                        AacSettings: {
                            Bitrate: 96000,
                            CodingMode: 'CODING_MODE_2_0',
                            SampleRate: 48000,
                        },
                    },
                }],
            }],
        }],
    };
}
