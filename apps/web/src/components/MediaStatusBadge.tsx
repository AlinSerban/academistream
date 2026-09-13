import type { Video } from '../features/content/types'

type MediaStatus = Video['mediaStatus']

const statusClass: Record<MediaStatus, string> = {
  ready: 'status status-ready',
  processing: 'status status-processing',
  queued: 'status status-queued',
  failed: 'status status-failed',
}

export function MediaStatusBadge({ status }: { status: MediaStatus }) {
  return <span className={statusClass[status]}>{status}</span>
}
