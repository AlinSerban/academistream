import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/PageHeader'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { useMeQuery } from '../auth/authApi'
import {
  useGetVideosQuery,
  useLazyGetPlaybackUrlQuery,
} from '../content/contentApi'
import {
  useCreateAssignmentMutation,
  useGetAssignmentsQuery,
  useGetCompletionsQuery,
  useGetLearnersQuery,
  useGetMyAssignmentsQuery,
  useGetMyCompletionsQuery,
  useGetMyProgressQuery,
  useGetProgressQuery,
  useUpsertProgressMutation,
} from './trainingApi'

const PAGE_SIZE = 5
/** Mirrors API completion threshold — keep in sync with training types. */
const COMPLETION_PERCENT_THRESHOLD = 90
const COMPLETION_HINT = `At ${COMPLETION_PERCENT_THRESHOLD}% or above, the assignment is marked complete and progress can no longer be edited.`

export function TrainingPage() {
  const { data: me } = useMeQuery()
  const role = me?.memberships[0]?.role
  const isStaff = role === 'tenant_admin' || role === 'instructor'
  const isLearner = role === 'learner'

  return (
    <>
      <PageHeader
        title={isLearner ? 'My training' : 'Training'}
        subtitle={
          me
            ? isLearner
              ? `Assigned videos · ${me.email}`
              : `Assignments & progress · ${me.email}`
            : isLearner
              ? 'Your assigned videos'
              : 'Assignments & progress'
        }
      />

      {isStaff ? <StaffTraining /> : null}
      {isLearner ? <LearnerTraining /> : null}
      {!isStaff && !isLearner ? (
        <p className="text-muted text-sm">
          No workspace role is linked to this account, so training is unavailable.
        </p>
      ) : null}
    </>
  )
}

function StaffTraining() {
  const { data: videos = [] } = useGetVideosQuery()
  const { data: learners = [] } = useGetLearnersQuery()
  const { data: assignments = [], isError: assignError } =
    useGetAssignmentsQuery()
  const { data: progress = [] } = useGetProgressQuery()
  const { data: completions = [] } = useGetCompletionsQuery()
  const [createAssignment, createState] = useCreateAssignmentMutation()

  const [videoId, setVideoId] = useState('')
  const [userId, setUserId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const [assignPage, setAssignPage] = useState(1)
  const [progressPage, setProgressPage] = useState(1)
  const [completionsPage, setCompletionsPage] = useState(1)

  useEffect(() => {
    setAssignPage(1)
  }, [assignments.length])
  useEffect(() => {
    setProgressPage(1)
  }, [progress.length])
  useEffect(() => {
    setCompletionsPage(1)
  }, [completions.length])

  const publishedReady = useMemo(
    () =>
      videos.filter(
        (v) => v.publishState === 'published' && v.mediaStatus === 'ready',
      ),
    [videos],
  )

  const pagedAssignments = slicePage(assignments, assignPage, PAGE_SIZE)
  const pagedProgress = slicePage(progress, progressPage, PAGE_SIZE)
  const pagedCompletions = slicePage(completions, completionsPage, PAGE_SIZE)

  async function onAssign(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      await createAssignment({
        videoId: Number(videoId),
        userId: Number(userId),
      }).unwrap()
      setMessage('Assigned.')
      setVideoId('')
      setUserId('')
    } catch {
      setMessage('Assign failed (need published video + learner in tenant).')
    }
  }

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Assign training</h2>
        </header>
        <div className="panel-body">
          <form className="flex max-w-lg flex-col gap-4" onSubmit={onAssign}>
            <label className="field-label">
              Video
              <select
                className="select"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                required
              >
                <option value="">Select published ready video</option>
                {publishedReady.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Learner
              <select
                className="select"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              >
                <option value="">Select learner</option>
                {learners.map((l) => (
                  <option key={l.userId} value={l.userId}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary w-fit"
              type="submit"
              disabled={createState.isLoading}
            >
              {createState.isLoading ? 'Assigning…' : 'Assign'}
            </button>
          </form>
          {message ? <p className="alert-info mt-3 text-sm">{message}</p> : null}
          {assignError ? (
            <p className="alert-error mt-2">Could not load assignments.</p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Assignments</h2>
          {assignments.length > 0 ? (
            <span className="panel-count">
              {assignments.length}{' '}
              {assignments.length === 1 ? 'assignment' : 'assignments'}
            </span>
          ) : null}
        </header>
        {assignments.length === 0 ? (
          <p className="panel-empty">None yet.</p>
        ) : (
          <>
            <table className="data-table data-table-zebra">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Learner</th>
                  <th>Video</th>
                </tr>
              </thead>
              <tbody>
                {pagedAssignments.map((a) => (
                  <tr key={a.id}>
                    <td className="col-id cell-id">{a.id}</td>
                    <td className="cell-secondary">User {a.userId}</td>
                    <td className="cell-primary">
                      {a.videoTitle ?? `Video ${a.videoId}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={assignPage}
              pageSize={PAGE_SIZE}
              total={assignments.length}
              onPageChange={setAssignPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Tenant progress</h2>
          {progress.length > 0 ? (
            <span className="panel-count">
              {progress.length} {progress.length === 1 ? 'row' : 'rows'}
            </span>
          ) : null}
        </header>
        {progress.length === 0 ? (
          <p className="panel-empty">No progress rows.</p>
        ) : (
          <>
            <table className="data-table data-table-zebra">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Learner</th>
                  <th>Video</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {pagedProgress.map((p) => (
                  <tr key={p.id}>
                    <td className="col-id cell-id">{p.id}</td>
                    <td className="cell-secondary">User {p.userId}</td>
                    <td className="cell-secondary">Video {p.videoId}</td>
                    <td className="cell-primary">{p.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={progressPage}
              pageSize={PAGE_SIZE}
              total={progress.length}
              onPageChange={setProgressPage}
            />
          </>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Completions</h2>
          {completions.length > 0 ? (
            <span className="panel-count">
              {completions.length}{' '}
              {completions.length === 1 ? 'completion' : 'completions'}
            </span>
          ) : null}
        </header>
        {completions.length === 0 ? (
          <p className="panel-empty">No completions yet.</p>
        ) : (
          <>
            <table className="data-table data-table-zebra">
              <thead>
                <tr>
                  <th className="col-id">ID</th>
                  <th>Learner</th>
                  <th>Video</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {pagedCompletions.map((c) => (
                  <tr key={c.id}>
                    <td className="col-id cell-id">{c.id}</td>
                    <td className="cell-secondary">User {c.userId}</td>
                    <td className="cell-secondary">Video {c.videoId}</td>
                    <td className="cell-secondary">
                      {new Date(c.completedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={completionsPage}
              pageSize={PAGE_SIZE}
              total={completions.length}
              onPageChange={setCompletionsPage}
            />
          </>
        )}
      </section>
    </>
  )
}

function LearnerTraining() {
  const { data: assignments = [], isLoading } = useGetMyAssignmentsQuery()
  const { data: progress = [] } = useGetMyProgressQuery()
  const { data: completions = [] } = useGetMyCompletionsQuery()
  const [upsertProgress, upsertState] = useUpsertProgressMutation()
  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const [percentByVideo, setPercentByVideo] = useState<Record<number, string>>(
    {},
  )
  const [playbackByVideoId, setPlaybackByVideoId] = useState<
    Record<number, string>
  >({})
  const [msg, setMsg] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [assignments.length])

  const progressByVideo = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of progress) map.set(p.videoId, p.percent)
    return map
  }, [progress])

  const completedVideos = useMemo(
    () => new Set(completions.map((c) => c.videoId)),
    [completions],
  )

  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => b.id - a.id),
    [assignments],
  )

  const pagedAssignments = slicePage(sortedAssignments, page, PAGE_SIZE)

  async function onReport(videoId: number, title: string) {
    setMsg(null)
    const raw =
      percentByVideo[videoId] ?? String(progressByVideo.get(videoId) ?? 0)
    const percent = Number(raw)
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setMsg('Enter a progress value between 0 and 100.')
      return
    }
    try {
      const result = await upsertProgress({ videoId, percent }).unwrap()
      setMsg(
        result.completion
          ? `“${title}” marked complete.`
          : `Saved ${result.progress.percent}% on “${title}”.`,
      )
    } catch {
      setMsg('Could not save progress. The video may still be processing or unpublished.')
    }
  }

  async function onPlay(videoId: number) {
    setMsg(null)
    try {
      const result = await fetchPlayback(videoId).unwrap()
      setPlaybackByVideoId((prev) => ({ ...prev, [videoId]: result.url }))
    } catch {
      setMsg('Playback is unavailable for this video right now.')
    }
  }

  if (isLoading) {
    return <p className="panel-empty">Loading your assignments…</p>
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">Assigned videos</h2>
        {assignments.length > 0 ? (
          <span className="panel-count">
            {completedVideos.size}/{assignments.length} complete
          </span>
        ) : null}
      </header>
      {assignments.length === 0 ? (
        <div className="panel-body">
          <p className="cell-primary mb-2">Nothing assigned yet</p>
          <p className="text-muted text-sm">
            When an instructor assigns training, it will show up here. You can
            watch each video and record your progress.
          </p>
        </div>
      ) : (
        <>
          <table className="data-table data-table-zebra">
            <thead>
              <tr>
                <th>Video</th>
                <th>Status</th>
                <th>
                  <span className="th-label">
                    Progress
                    <span
                      className="info-hint"
                      title={COMPLETION_HINT}
                      aria-label={COMPLETION_HINT}
                      tabIndex={0}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        width="10"
                        height="10"
                        fill="currentColor"
                      >
                        <circle cx="8" cy="4.25" r="1.15" />
                        <rect x="7.15" y="6.5" width="1.7" height="6" rx="0.85" />
                      </svg>
                    </span>
                  </span>
                </th>
                <th>Update</th>
                <th className="col-actions">
                  <span className="sr-only">Watch</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedAssignments.map((a) => {
                const title = a.videoTitle ?? `Video #${a.videoId}`
                const percent = progressByVideo.get(a.videoId) ?? 0
                const done = completedVideos.has(a.videoId)
                const playbackUrl = playbackByVideoId[a.videoId]
                const playable =
                  playbackUrl != null &&
                  (playbackUrl.startsWith('http://') ||
                    playbackUrl.startsWith('https://'))
                const fetchingPlay =
                  playbackState.isFetching &&
                  playbackState.originalArgs === a.videoId

                return (
                  <Fragment key={a.id}>
                    <tr>
                      <td>
                        <span className="cell-primary">{title}</span>
                      </td>
                      <td>
                        {done ? (
                          <span className="status status-ready">completed</span>
                        ) : percent > 0 ? (
                          <span className="status status-processing">
                            in progress
                          </span>
                        ) : (
                          <span className="status status-queued">not started</span>
                        )}
                      </td>
                      <td className="cell-secondary">{percent}%</td>
                      <td>
                        {done ? (
                          <span className="cell-secondary">—</span>
                        ) : (
                          <div className="form-row-controls">
                            <input
                              className="input input-compact !w-20"
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`Progress for ${title}`}
                              placeholder="%"
                              value={
                                percentByVideo[a.videoId] ??
                                (percent > 0 ? String(percent) : '')
                              }
                              onChange={(e) =>
                                setPercentByVideo((prev) => ({
                                  ...prev,
                                  [a.videoId]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              disabled={upsertState.isLoading}
                              onClick={() => void onReport(a.videoId, title)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              type="button"
                              disabled={upsertState.isLoading}
                              onClick={() => {
                                setPercentByVideo((prev) => ({
                                  ...prev,
                                  [a.videoId]: '100',
                                }))
                                void upsertProgress({
                                  videoId: a.videoId,
                                  percent: 100,
                                })
                                  .unwrap()
                                  .then((result) => {
                                    setMsg(
                                      result.completion
                                        ? `“${title}” marked complete.`
                                        : `Saved 100% on “${title}”.`,
                                    )
                                  })
                                  .catch(() => {
                                    setMsg(
                                      'Could not save progress. The video may still be processing or unpublished.',
                                    )
                                  })
                              }}
                            >
                              Complete
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="col-actions">
                        <button
                          className="link-accent cursor-pointer border-0 bg-transparent p-0 text-sm"
                          type="button"
                          disabled={fetchingPlay}
                          onClick={() => void onPlay(a.videoId)}
                        >
                          {fetchingPlay
                            ? 'Loading…'
                            : playbackUrl
                              ? 'Reload'
                              : 'Watch'}
                        </button>
                      </td>
                    </tr>
                    {playbackUrl ? (
                      <tr className="row-expand">
                        <td colSpan={5}>
                          {playable ? (
                            <video
                              className="playback-frame"
                              controls
                              preload="metadata"
                              src={playbackUrl}
                            >
                              Your browser does not support inline video playback.
                            </video>
                          ) : (
                            <p className="text-muted text-xs">
                              Open playback URL:{' '}
                              <a className="link-accent break-all" href={playbackUrl}>
                                {playbackUrl}
                              </a>
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            pageSize={PAGE_SIZE}
            total={sortedAssignments.length}
            onPageChange={setPage}
          />
        </>
      )}
      {msg ? <p className="alert-info px-5 pb-4 text-sm">{msg}</p> : null}
    </section>
  )
}
