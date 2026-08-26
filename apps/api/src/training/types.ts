export interface CreateAssignmentInput {
    videoId: number
    userId: number
}

export interface UpsertProgressInput {
    videoId: number
    percent: number
    positionSeconds?: number
}

/** Completion threshold for S3-04 (client-reported percent). */
export const COMPLETION_PERCENT_THRESHOLD = 90
