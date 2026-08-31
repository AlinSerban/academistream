export type PublishState = 'draft' | 'published'
export type MediaStatus = 'queued' | 'processing' | 'ready' | 'failed'

export interface Course {
  id: number
  tenantId: number
  title: string
  createdAt: string
  updatedAt: string
}

export interface Video {
  id: number
  tenantId: number
  courseId: number
  title: string
  storageKey: string | null
  playbackKey: string | null
  publishState: PublishState
  mediaStatus: MediaStatus
  createdAt: string
  updatedAt: string
}

export interface CreateCourseRequest {
  title: string
}

export interface CreateVideoRequest {
  title: string
  courseId: number
}

export interface PlaybackResponse {
  url: string
  expiresIn: number
}

export interface UploadVideoArg {
  videoId: number
  file: File
}
