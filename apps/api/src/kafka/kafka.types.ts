export type VideoProcessingJob = {
  videoId: number;
  tenantId: number;
  storageKey: string;
  action: 'process' | 'cancel'
};
