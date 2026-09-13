import type { Job } from '@aws-sdk/client-mediaconvert';
import { formatMediaConvertJobFailure } from './media-convert.service';

describe('formatMediaConvertJobFailure', () => {
    it('includes status, error code, and message when all present', () => {
        const job = {
            Status: 'ERROR',
            ErrorCode: 1040,
            ErrorMessage: 'Invalid selector_sequence_id [0] specified for audio_description [1].',
        } as Job;

        expect(formatMediaConvertJobFailure(job)).toBe(
            'MediaConvert job ERROR (1040): Invalid selector_sequence_id [0] specified for audio_description [1].',
        );
    });

    it('falls back to status only when no error details', () => {
        expect(formatMediaConvertJobFailure({ Status: 'CANCELED' } as Job)).toBe(
            'MediaConvert job CANCELED',
        );
    });
});
