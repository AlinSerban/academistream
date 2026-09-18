import { Link } from 'react-router-dom'
import { MediaStatusBadge } from '../../components/MediaStatusBadge'
import { usePublishVideoMutation } from './contentApi'
import type { PublishState } from './types'
import type { VideoTableRowProps } from './libraryTypes'

export function VideoTableRow({
  video,
  courseTitle,
  isFetchingPlayback,
  onPlayback,
}: VideoTableRowProps) {
  const [publishVideo, publishState] = usePublishVideoMutation()
  const isPublished = video.publishState === 'published'

  async function onVisibilityChange(next: PublishState) {
    if (next === video.publishState) return
    try {
      await publishVideo({
        videoId: video.id,
        publishState: next,
      }).unwrap()
    } catch {
      // list refresh / error via RTK; keep row usable
    }
  }

  return (
    <tr>
      <td className="col-id cell-id">{video.id}</td>
      <td className="cell-primary">{video.title}</td>
      <td className="cell-secondary">{courseTitle}</td>
      <td className="col-media">
        <MediaStatusBadge status={video.mediaStatus} />
      </td>
      <td className="col-visibility">
        <label className="sr-only" htmlFor={`visibility-${video.id}`}>
          Visibility
        </label>
        <select
          id={`visibility-${video.id}`}
          className={
            isPublished
              ? 'select visibility-select is-published'
              : 'select visibility-select'
          }
          value={video.publishState}
          disabled={publishState.isLoading}
          onChange={(e) =>
            void onVisibilityChange(e.target.value as PublishState)
          }
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </td>
      <td className="col-actions">
        {video.mediaStatus === 'ready' ? (
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={isFetchingPlayback}
            onClick={onPlayback}
          >
            {isFetchingPlayback ? 'Loading…' : 'Play'}
          </button>
        ) : video.mediaStatus === 'failed' ? (
          <Link className="link-accent text-sm" to="/notifications">
            Details
          </Link>
        ) : (
          <span className="cell-secondary">-</span>
        )}
      </td>
    </tr>
  )
}
