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
import { useMeQuery } from '../auth/authApi'
import {
  useCreateCourseMutation,
  useCreateVideoMutation,
  useGetCoursesQuery,
  useGetVideosQuery,
  useLazyGetPlaybackUrlQuery,
  useUploadVideoMutation,
} from './contentApi'
import type { Video } from './types'

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
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})

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
    setUploadMessage(null)
    const title = videoTitle.trim()
    const parsedCourseId = Number(courseId)
    if (!title || !parsedCourseId || !file) {
      setUploadMessage('Title, course, and file are required.')
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
      setUploadMessage(`Uploaded “${video.title}” — waiting for processing…`)
      setPollMs(2000)
    } catch {
      setUploadMessage('Create or upload failed.')
    }
  }

  async function onPlayback(videoId: number) {
    try {
      const result = await fetchPlayback(videoId).unwrap()
      setPlaybackByVideoId((prev) => ({ ...prev, [videoId]: result.url }))
    } catch {
      // shown via playbackState
    }
  }

  const expandedVideoId =
    playbackState.originalArgs ??
    (Object.keys(playbackByVideoId).length > 0
      ? Number(Object.keys(playbackByVideoId).at(-1))
      : null)

  if (isLearner) {
    return <Navigate to="/training" replace />
  }

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle={me ? `Courses and videos · ${me.email}` : 'Courses and videos'}
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
            <label className="field-label">
              File
              <input
                className="text-sm"
                type="file"
                accept="video/*,.mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
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
          {uploadMessage ? (
            <p className="alert-info mt-3 text-sm">{uploadMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Videos</h2>
          {!videosLoading && !videosError && videos.length > 0 ? (
            <span className="panel-count">
              {videoStatusFilter !== 'all'
                ? `${filteredVideos.length} of ${videos.length}`
                : `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`}
            </span>
          ) : null}
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
                  <th className="col-search">
                    <label className="sr-only" htmlFor="video-status-filter">
                      Media status
                    </label>
                    <select
                      id="video-status-filter"
                      className="select"
                      value={videoStatusFilter}
                      onChange={(e) => setVideoStatusFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="queued">Queued</option>
                      <option value="processing">Processing</option>
                      <option value="ready">Ready</option>
                      <option value="failed">Failed</option>
                    </select>
                  </th>
                  <th>Publish</th>
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
                  pagedVideos.map((video) => (
                    <VideoTableRow
                      key={video.id}
                      video={video}
                      courseTitle={
                        courseTitleById.get(video.courseId) ??
                        `Course ${video.courseId}`
                      }
                      playbackUrl={playbackByVideoId[video.id]}
                      isFetchingPlayback={
                        playbackState.isFetching &&
                        playbackState.originalArgs === video.id
                      }
                      playbackError={
                        playbackState.isError &&
                        playbackState.originalArgs === video.id
                      }
                      showPlayer={
                        expandedVideoId === video.id &&
                        playbackByVideoId[video.id] != null
                      }
                      onPlayback={() => void onPlayback(video.id)}
                    />
                  ))
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
    </>
  )
}

function VideoTableRow({
  video,
  courseTitle,
  playbackUrl,
  isFetchingPlayback,
  playbackError,
  showPlayer,
  onPlayback,
}: {
  video: Video
  courseTitle: string
  playbackUrl?: string
  isFetchingPlayback: boolean
  playbackError: boolean
  showPlayer: boolean
  onPlayback: () => void
}) {
  const playableInBrowser = playbackUrl != null && isBrowserPlayableUrl(playbackUrl)

  return (
    <>
      <tr>
        <td className="col-id cell-id">{video.id}</td>
        <td className="cell-primary">{video.title}</td>
        <td className="cell-secondary">{courseTitle}</td>
        <td>
          <MediaStatusBadge status={video.mediaStatus} />
        </td>
        <td className="cell-secondary">{video.publishState}</td>
        <td className="col-actions">
          {video.mediaStatus === 'ready' ? (
            <button
              className="link-accent cursor-pointer border-0 bg-transparent p-0 text-sm"
              type="button"
              disabled={isFetchingPlayback}
              onClick={onPlayback}
            >
              {isFetchingPlayback ? 'Loading…' : playbackUrl ? 'Reload' : 'Play'}
            </button>
          ) : video.mediaStatus === 'failed' ? (
            <Link className="link-accent text-sm" to="/notifications">
              Details
            </Link>
          ) : (
            <span className="cell-secondary">—</span>
          )}
        </td>
      </tr>
      {showPlayer && video.mediaStatus === 'ready' ? (
        <tr className="row-expand">
          <td colSpan={6}>
            {playableInBrowser ? (
              <video
                className="playback-frame"
                controls
                preload="metadata"
                src={playbackUrl}
              >
                Your browser does not support inline video playback.
              </video>
            ) : playbackUrl ? (
              <p className="text-muted text-xs">
                Inline playback needs HTTPS. Local file URLs:{' '}
                <a className="link-accent break-all" href={playbackUrl}>
                  {playbackUrl}
                </a>
              </p>
            ) : null}
            {playbackError ? (
              <p className="alert-error mt-2" role="alert">
                Could not get playback URL.
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}

function isBrowserPlayableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
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
