import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useLogoutMutation, useMeQuery } from '../auth/authApi'
import {
  useCreateCourseMutation,
  useCreateVideoMutation,
  useGetCoursesQuery,
  useGetVideosQuery,
  useLazyGetPlaybackUrlQuery,
  useUploadVideoMutation,
} from './contentApi'
import type { Video } from './types'

export function LibraryPage() {
  const navigate = useNavigate()
  const { data: me } = useMeQuery()
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const {
    data: courses = [],
    isLoading: coursesLoading,
    isError: coursesError,
    error: coursesErr,
  } = useGetCoursesQuery()

  const [pollMs, setPollMs] = useState(0)
  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
    error: videosErr,
  } = useGetVideosQuery(undefined, { pollingInterval: pollMs })

  useEffect(() => {
    const busy = videos.some(
      (v) => v.mediaStatus === 'queued' || v.mediaStatus === 'processing',
    )
    setPollMs(busy ? 2000 : 0)
  }, [videos])

  const courseTitleById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of courses) map.set(c.id, c.title)
    return map
  }, [courses])

  const [courseTitle, setCourseTitle] = useState('')
  const [createCourse, createCourseState] = useCreateCourseMutation()

  const [videoTitle, setVideoTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [createVideo, createVideoState] = useCreateVideoMutation()
  const [uploadVideo, uploadVideoState] = useUploadVideoMutation()
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})

  async function onCreateCourse(event: FormEvent) {
    event.preventDefault()
    const title = courseTitle.trim()
    if (!title) return
    try {
      await createCourse({ title }).unwrap()
      setCourseTitle('')
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
      setUploadMessage(`Uploaded video #${video.id} — waiting for processing…`)
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-left">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Library</h1>
          <p className="mt-1 text-sm text-slate-600">
            {me ? `Signed in as ${me.email}` : 'Content for your tenant'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            to="/me"
          >
            Profile
          </Link>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            type="button"
            disabled={isLoggingOut}
            onClick={() => void onLogout()}
          >
            {isLoggingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Courses</h2>
        {coursesLoading ? (
          <p className="text-sm text-slate-600">Loading courses…</p>
        ) : coursesError ? (
          <p className="text-sm text-red-600" role="alert">
            {getListErrorMessage(coursesErr)}
          </p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-slate-600">No courses yet.</p>
        ) : (
          <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-slate-900">
            {courses.map((c) => (
              <li key={c.id}>
                #{c.id} — {c.title}
              </li>
            ))}
          </ul>
        )}

        <form className="flex flex-wrap items-end gap-2" onSubmit={onCreateCourse}>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-slate-700">
            New course title
            <input
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              required
            />
          </label>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            type="submit"
            disabled={createCourseState.isLoading}
          >
            {createCourseState.isLoading ? 'Creating…' : 'Create course'}
          </button>
        </form>
        {createCourseState.isError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            Could not create course.
          </p>
        ) : null}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Create + upload video
        </h2>
        <form className="flex flex-col gap-3" onSubmit={onCreateAndUpload}>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Title
            <input
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Course
            <select
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} — {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            File
            <input
              className="text-sm text-slate-800"
              type="file"
              accept="video/*,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>
          <button
            className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
          <p className="mt-2 text-sm text-slate-700">{uploadMessage}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Videos</h2>
        {videosLoading ? (
          <p className="text-sm text-slate-600">Loading videos…</p>
        ) : videosError ? (
          <p className="text-sm text-red-600" role="alert">
            {getListErrorMessage(videosErr)}
          </p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-slate-600">No videos yet.</p>
        ) : (
          <ul className="space-y-4">
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                courseTitle={
                  courseTitleById.get(video.courseId) ?? `course #${video.courseId}`
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
                onPlayback={() => void onPlayback(video.id)}
              />
            ))}
          </ul>
        )}
        {pollMs > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Polling media status…
          </p>
        ) : null}
      </section>
    </main>
  )
}

function VideoRow({
  video,
  courseTitle,
  playbackUrl,
  isFetchingPlayback,
  playbackError,
  onPlayback,
}: {
  video: Video
  courseTitle: string
  playbackUrl?: string
  isFetchingPlayback: boolean
  playbackError: boolean
  onPlayback: () => void
}) {
  return (
    <li className="border-t border-slate-200 pt-3 text-sm text-slate-900">
      <p className="font-medium">
        #{video.id} — {video.title}
      </p>
      <p className="mt-1 text-slate-600">
        {courseTitle} · {video.publishState} · media: {video.mediaStatus}
      </p>
      {video.mediaStatus === 'ready' ? (
        <div className="mt-2">
          <button
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            type="button"
            disabled={isFetchingPlayback}
            onClick={onPlayback}
          >
            {isFetchingPlayback ? 'Fetching…' : 'Get playback URL'}
          </button>
          {playbackUrl ? (
            <p className="mt-2 break-all text-xs text-slate-700">
              <a
                className="underline hover:text-slate-900"
                href={playbackUrl}
                target="_blank"
                rel="noreferrer"
              >
                {playbackUrl}
              </a>
            </p>
          ) : null}
          {playbackError ? (
            <p className="mt-1 text-sm text-red-600" role="alert">
              Could not get playback URL.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
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
