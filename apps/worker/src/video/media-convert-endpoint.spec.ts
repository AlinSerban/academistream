import { mediaConvertRegionalEndpoint } from './media-convert-endpoint';

describe('mediaConvertRegionalEndpoint', () => {
    it('returns the standard regional HTTPS endpoint', () => {
        expect(mediaConvertRegionalEndpoint('eu-central-1')).toBe(
            'https://mediaconvert.eu-central-1.amazonaws.com',
        );
    });
});
