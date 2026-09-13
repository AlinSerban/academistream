export interface CreateAssignmentInput {
    videoId: number
    userId: number
}

export interface UpsertProgressInput {
    videoId: number
    percent: number
    positionSeconds?: number
}

/** Client-reported watch percent that creates a completion. */
export const COMPLETION_PERCENT_THRESHOLD = 90
