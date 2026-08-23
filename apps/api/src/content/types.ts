export type PublishState = 'draft' | 'published';
export type MediaStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface CreateCourseInput {
    title: string
}

export interface CreateVideoInput {
    title: string
    courseId: number
}

export interface UpdateVideoInput {
    title: string
}

export interface PublishVideoInput {
    publishState: PublishState
}
