export interface Assignment {
  id: number
  tenantId: number
  videoId: number
  userId: number
  assignedByUserId: number | null
  createdAt: string
  videoTitle?: string
}

export interface MyAssignment extends Assignment {
  percent: number
  positionSeconds: number
  completed: boolean
}

export interface MyAssignmentsPage {
  items: MyAssignment[]
  total: number
  page: number
  pageSize: number
  stats: {
    assigned: number
    inProgress: number
    completed: number
    notStarted: number
  }
  continueAssignment: MyAssignment | null
}

export interface LearnerOption {
  userId: number
  email: string
  name: string
}

export interface CreateAssignmentRequest {
  videoId: number
  userId: number
}

export interface WatchProgress {
  id: number
  tenantId: number
  userId: number
  videoId: number
  positionSeconds: number
  percent: number
  updatedAt: string
}

export interface Completion {
  id: number
  tenantId: number
  userId: number
  videoId: number
  completedAt: string
}

export interface UpsertProgressRequest {
  videoId: number
  percent: number
  positionSeconds?: number
  allowDecrease?: boolean
}

export interface UpsertProgressResponse {
  progress: WatchProgress
  completion: Completion | null
  threshold: number
}

/** Mirrors API completion threshold — keep in sync with API training types. */
export const COMPLETION_PERCENT_THRESHOLD = 90

export const COMPLETION_HINT = `At ${COMPLETION_PERCENT_THRESHOLD}% or above, the assignment is marked complete and progress can no longer be edited.`

export type LearnerStatus = 'completed' | 'in_progress' | 'not_started'

export function learnerStatus(done: boolean, percent: number): LearnerStatus {
  if (done) return 'completed'
  if (percent > 0) return 'in_progress'
  return 'not_started'
}
