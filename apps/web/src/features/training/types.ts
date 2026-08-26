export interface Assignment {
  id: number
  tenantId: number
  videoId: number
  userId: number
  assignedByUserId: number | null
  createdAt: string
  videoTitle?: string
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
}

export interface UpsertProgressResponse {
  progress: WatchProgress
  completion: Completion | null
  threshold: number
}
