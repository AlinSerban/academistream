import { useEffect, useMemo, useState } from 'react'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useLazyGetPlaybackUrlQuery } from './contentApi'
import type { Video } from './types'
import { getListErrorMessage } from './libraryErrors'
import type { WatchTarget } from './libraryTypes'
import { VideoTableRow } from './VideoTableRow'

const VIDEO_PAGE_SIZE = 5

type Props = {
  videos: Video[]
  videosLoading: boolean
  videosError: boolean
  videosErr: FetchBaseQueryError | SerializedError | undefined
  courseTitleById: Map<number, string>
}

export function LibraryVideosPanel({
  videos,
  videosLoading,
  videosError,
  videosErr,
  courseTitleById,
}: Props) {
  const [videoStatusFilter, setVideoStatusFilter] = useState('all')
  const [videoPage, setVideoPage] = useState(1)
  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null)

  const filteredVideos = useMemo(() => {
    const list =
      videoStatusFilter === 'all'
        ? videos
        : videos.filter((v) => v.mediaStatus === videoStatusFilter)
    return [...list].sort((a, b) => b.id - a.id)
  }, [videos, videoStatusFilter])

  useEffect(() => {
    setVideoPage(1)
  }, [videoStatusFilter, videos.length])

  const pagedVideos = slicePage(filteredVideos, videoPage, VIDEO_PAGE_SIZE)

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
            {!videosLoading && !videosError && videos.length > 0 ? (
              <span className="panel-count">
                {videoStatusFilter !== 'all'
                  ? `${filteredVideos.length} of ${videos.length}`
                  : `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`}
              </span>
            ) : null}
            {!videosLoading && !videosError && videos.length > 0 ? (
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
        ) : videos.length === 0 ? (
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
                  {filteredVideos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cell-secondary">
                        No videos match that filter.
                      </td>
                    </tr>
                  ) : (
                    pagedVideos.map((video) => {
                      const courseTitle =
                        courseTitleById.get(video.courseId) ??
                        `Course ${video.courseId}`
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
              pageSize={VIDEO_PAGE_SIZE}
              total={filteredVideos.length}
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
