import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { MediaStatusBadge } from '../../components/MediaStatusBadge'
import { PageHeader } from '../../components/PageHeader'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useToast } from '../../components/Toast'
import { useMeQuery } from '../auth/authApi'
import {
  useCreateCourseMutation,
  useCreateVideoMutation,
  useGetCoursesQuery,
  useGetVideosQuery,
  useLazyGetPlaybackUrlQuery,
  usePublishVideoMutation,
  useUploadVideoMutation,
} from './contentApi'
import type { PublishState, Video } from './types'

const COURSE_PAGE_SIZE = 5
const VIDEO_PAGE_SIZE = 5

export function LibraryPage() {
  const { data: me } = useMeQuery()
  const isLearner = me?.memberships[0]?.role === 'learner'
  const {
    data: courses = [],
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErr,
  } = useGetCoursesQuery(undefined, {
    skip: me == null || isLearner,
  })

  const [pollMs, setPollMs] = useState(0)
  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
    error: videosErr,
  } = useGetVideosQuery(undefined, {
    pollingInterval: pollMs,
    skip: me == null || isLearner,
  })

  const mediaBusy = videos.some(
    (v) => v.mediaStatus === 'queued' || v.mediaStatus === 'processing',
  )

  useEffect(() => {
    setPollMs(mediaBusy ? 2000 : 0)
  }, [mediaBusy])

  const courseTitleById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of courses) map.set(c.id, c.title)
    return map
  }, [courses])

  const [courseTitle, setCourseTitle] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [coursePage, setCoursePage] = useState(1)
  const [createCourse, createCourseState] = useCreateCourseMutation()

  const [videoTitle, setVideoTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [videoStatusFilter, setVideoStatusFilter] = useState('all')
  const [videoPage, setVideoPage] = useState(1)
  const [createVideo, createVideoState] = useCreateVideoMutation()
  const [uploadVideo, uploadVideoState] = useUploadVideoMutation()
  const { showToast } = useToast()

  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})
  const [watchTarget, setWatchTarget] = useState<{
    videoId: number
    title: string
    courseTitle: string
  } | null>(null)

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase()
    const list = !q
      ? courses
      : courses.filter(
          (c) => c.title.toLowerCase().includes(q) || String(c.id).includes(q),
        )
    return [...list].sort((a, b) => b.id - a.id)
  }, [courses, courseQuery])

  const filteredVideos = useMemo(() => {
    const list =
      videoStatusFilter === 'all'
        ? videos
        : videos.filter((v) => v.mediaStatus === videoStatusFilter)
    return [...list].sort((a, b) => b.id - a.id)
  }, [videos, videoStatusFilter])

  useEffect(() => {
    setCoursePage(1)
  }, [courseQuery, courses.length])

  useEffect(() => {
    setVideoPage(1)
  }, [videoStatusFilter, videos.length])

  const pagedCourses = slicePage(filteredCourses, coursePage, COURSE_PAGE_SIZE)
  const pagedVideos = slicePage(filteredVideos, videoPage, VIDEO_PAGE_SIZE)

  async function onCreateCourse(event: FormEvent) {
    event.preventDefault()
    const title = courseTitle.trim()
    if (!title) return
    try {
      await createCourse({ title }).unwrap()
      setCourseTitle('')
      setCourseQuery('')
      setCoursePage(1)
    } catch {
      // mutation error shown below
    }
  }

  async function onCreateAndUpload(event: FormEvent) {
    event.preventDefault()
    const title = videoTitle.trim()
    const parsedCourseId = Number(courseId)
    if (!title || !parsedCourseId || !file) {
      showToast({
        message: 'Title, course, and file are required.',
        tone: 'error',
      })
      return
    }
    const maxBytes = 50 * 1024 * 1024
    if (file.size > maxBytes) {
      showToast({
        message: 'File too large. Maximum upload size is 50MB.',
        tone: 'error',
      })
      return
    }
    try {
      const video = await createVideo({
        title,
        courseId: parsedCourseId,
      }).unwrap()
      await uploadVideo({ videoId: video.id, file }).unwrap()
      setVideoTitle('')
      setFile(null)
      showToast({
        message: `Uploaded "${video.title}". Waiting for processing…`,
        tone: 'success',
      })
      setPollMs(2000)
    } catch {
      showToast({ message: 'Create or upload failed.', tone: 'error' })
    }
  }

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

  function closeWatch() {
    setWatchTarget(null)
  }

  if (isLearner) {
    return <Navigate to="/training" replace />
  }

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle={me ? `${me.email}` : undefined}
      />

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Courses</h2>
          {!coursesLoading && !coursesError && courses.length > 0 ? (
            <span className="panel-count">
              {courseQuery.trim()
                ? `${filteredCourses.length} of ${courses.length}`
                : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
            </span>
          ) : null}
        </header>

        {coursesLoading ? (
          <p className="panel-empty">Loading courses…</p>
        ) : coursesError ? (
          <p className="alert-error panel-empty" role="alert">
            {getListErrorMessage(coursesErr)}
          </p>
        ) : courses.length === 0 ? (
          <p className="panel-empty">No courses yet. Create one below.</p>
        ) : (
          <>
            <table className="data-table data-table-zebra">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Course</th>
                  <th className="col-search">
                    <label className="sr-only" htmlFor="course-search">
                      Search courses
                    </label>
                    <input
                      id="course-search"
                      className="input"
                      type="search"
                      placeholder="Search…"
                      value={courseQuery}
                      onChange={(e) => setCourseQuery(e.target.value)}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="cell-secondary">
                      No courses match that search.
                    </td>
                  </tr>
                ) : (
                  pagedCourses.map((c) => (
                    <tr key={c.id}>
                      <td className="col-id cell-id">{c.id}</td>
                      <td className="cell-primary">{c.title}</td>
                      <td aria-hidden="true" />
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <PaginationControls
              page={coursePage}
              pageSize={COURSE_PAGE_SIZE}
              total={filteredCourses.length}
              onPageChange={setCoursePage}
            />
          </>
        )}

        <div className="panel-footer">
          <p className="panel-footer-label">Add course</p>
          <form className="form-row" onSubmit={onCreateCourse}>
            <div className="form-row-controls">
              <input
                className="input"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Course title"
                required
                aria-label="New course title"
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={createCourseState.isLoading}
              >
                {createCourseState.isLoading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
          {createCourseState.isError ? (
            <p className="alert-error mt-2" role="alert">
              Could not create course.
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Create & upload video</h2>
        </header>
        <div className="panel-body">
          <form className="flex max-w-lg flex-col gap-4" onSubmit={onCreateAndUpload}>
            <label className="field-label">
              Title
              <input
                className="input"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Course
              <select
                className="select"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                <option value="">Select a course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-label">
              File
              <label className="file-picker">
                <input
                  className="file-picker-input"
                  type="file"
                  accept="video/*,.mp4"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
                <span className="btn btn-secondary file-picker-btn" aria-hidden="true">
                  Choose file
                </span>
                <span className="file-picker-name">
                  {file ? file.name : 'No file selected'}
                </span>
              </label>
              <span className="text-muted text-xs">
                Maximum upload size is 50MB.
              </span>
            </div>
            <button
              className="btn btn-primary w-fit"
              type="submit"
              disabled={
                createVideoState.isLoading ||
                uploadVideoState.isLoading ||
                courses.length === 0
              }
            >
              {createVideoState.isLoading || uploadVideoState.isLoading
                ? 'Uploading…'
                : 'Create & upload'}
            </button>
          </form>
        </div>
      </section>

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
          onClose={closeWatch}
        />
      ) : null}
    </>
  )
}

function VideoTableRow({
  video,
  courseTitle,
  isFetchingPlayback,
  onPlayback,
}: {
  video: Video
  courseTitle: string
  isFetchingPlayback: boolean
  onPlayback: () => void
}) {
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

function getListErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  if (error && 'status' in error && error.status === 401) {
    return 'Session expired. Please sign in again.'
  }
  if (error && 'status' in error && error.status === 403) {
    return 'You do not have access to the content library (need tenant admin or instructor).'
  }
  return 'Could not load content. Is the API running?'
}
