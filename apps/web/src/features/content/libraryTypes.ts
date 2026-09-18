import type { PublishState, Video } from './types'

export type VideoTableRowProps = {
  video: Video
  courseTitle: string
  isFetchingPlayback: boolean
  onPlayback: () => void
}

export type WatchTarget = {
  videoId: number
  title: string
  courseTitle: string
}

export type { PublishState, Video }
