import { useEffect, useState } from 'react'
import { PaginationControls } from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useGetVideosQuery, useLazyGetPlaybackUrlQuery } from './contentApi'
import type { Video } from './types'
import { getListErrorMessage } from './libraryErrors'
import type { WatchTarget } from './libraryTypes'
import { VideoTableRow } from './VideoTableRow'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'

type Props = {
  pollMs: number
  onMediaBusyChange: (busy: boolean) => void
}

export function LibraryVideosPanel({ pollMs, onMediaBusyChange }: Props) {
  const [videoStatusFilter, setVideoStatusFilter] = useState('all')
  const [videoPage, setVideoPage] = useState(1)
  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)

  useEffect(() => {
    setVideoPage(1)
  }, [videoStatusFilter])

  const {
    data,
    isLoading: videosLoading,
    isError: videosError,
    error: videosErr,
  } = useGetVideosQuery(
    {
      page: videoPage,
      pageSize: DEFAULT_PAGE_SIZE,
      mediaStatus: videoStatusFilter,
    },
    { pollingInterval: pollMs },
  )

  const videos = data?.items ?? []
  const total = data?.total ?? 0

  useEffect(() => {
    onMediaBusyChange(Boolean(data?.mediaBusy))
  }, [data?.mediaBusy, onMediaBusyChange])

  async function onPlayback(video: Video, courseTitle: string) {
    setWatchTarget({
      videoId: video.id,
      title: video.title,
      courseTitle,
    })
    try {
      const result = await fetchPlayback(video.id).unwrap()
      setPlaybackByVideoId((prev) => ({ ...prev, [video.id]: result.url }))
    } catch {
      // shown via playbackState / modal error
    }
  }

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Videos</h2>
          <div className="panel-head-tools">
            {!videosLoading && !videosError && total > 0 ? (
              <span className="panel-count">
                {videoStatusFilter !== 'all'
                  ? `${total} match${total === 1 ? '' : 'es'}`
                  : `${total} ${total === 1 ? 'video' : 'videos'}`}
              </span>
            ) : null}
            {!videosLoading && !videosError ? (
              <>
                <label className="sr-only" htmlFor="video-status-filter">
                  Media status
                </label>
                <select
                  id="video-status-filter"
                  className="select table-compact-select"
                  value={videoStatusFilter}
                  onChange={(e) => setVideoStatusFilter(e.target.value)}
                >
                  <option value="all">All media</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="ready">Ready</option>
                  <option value="failed">Failed</option>
                </select>
              </>
            ) : null}
          </div>
        </header>

        {videosLoading ? (
          <p className="panel-empty">Loading videos…</p>
        ) : videosError ? (
          <p className="alert-error panel-empty" role="alert">
            {getListErrorMessage(videosErr)}
          </p>
        ) : total === 0 && videoStatusFilter === 'all' ? (
          <p className="panel-empty">No videos yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table-zebra">
                <thead>
                  <tr>
                    <th className="col-id">ID</th>
                    <th>Title</th>
                    <th>Course</th>
                    <th className="col-media">Media</th>
                    <th className="col-visibility">Visibility</th>
                    <th className="col-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {videos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cell-secondary">
                        No videos match that filter.
                      </td>
                    </tr>
                  ) : (
                    videos.map((video) => {
                      const courseTitle =
                        video.courseTitle ?? `Course ${video.courseId}`
                      return (
                        <VideoTableRow
                          key={video.id}
                          video={video}
                          courseTitle={courseTitle}
                          isFetchingPlayback={
                            playbackState.isFetching &&
                            playbackState.originalArgs === video.id
                          }
                          onPlayback={() => void onPlayback(video, courseTitle)}
                        />
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={videoPage}
              pageSize={DEFAULT_PAGE_SIZE}
              total={total}
              onPageChange={setVideoPage}
            />
          </>
        )}
      </section>

      {watchTarget ? (
        <VideoPlayerModal
          title={watchTarget.title}
          subtitle={watchTarget.courseTitle}
          playbackUrl={playbackByVideoId[watchTarget.videoId] ?? null}
          isLoading={
            playbackState.isFetching &&
            playbackState.originalArgs === watchTarget.videoId
          }
          error={
            playbackState.isError &&
            playbackState.originalArgs === watchTarget.videoId
              ? 'Could not get playback URL.'
              : null
          }
          onClose={() => setWatchTarget(null)}
        />
      ) : null}
    </>
  )
}
