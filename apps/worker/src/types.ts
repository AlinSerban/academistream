export type VideoProcessingJob = {
    videoId: number;
    tenantId: number;
    storageKey: string;
    action: 'process' | 'cancel'
};

export type VideoMediaEventsJob = {
    videoId: number,
    tenantId: number,
    status: 'ready' | 'failed',
    reason: string | null
}