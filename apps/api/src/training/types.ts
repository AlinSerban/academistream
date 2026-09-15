export interface CreateAssignmentInput {
    videoId: number
    userId: number
}

export interface UpsertProgressInput {
    videoId: number
    percent: number
    positionSeconds?: number
    /**
     * When true, replace stored percent/position even if lower.
     * Used for manual corrections; auto-tracking should omit this.
     */
    allowDecrease?: boolean
}

/** Client-reported watch percent that creates a completion. */
export const COMPLETION_PERCENT_THRESHOLD = 90
