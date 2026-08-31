/** Regional MediaConvert API endpoint (DescribeEndpoints discovery is deprecated). */
export function mediaConvertRegionalEndpoint(region: string): string {
    return `https://mediaconvert.${region}.amazonaws.com`;
}
