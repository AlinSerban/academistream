import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '../../components/PageHeader'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useToast } from '../../components/Toast'
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
import type { Assignment } from './types'

const PAGE_SIZE = 5
/** Mirrors API completion threshold — keep in sync with training types. */
const COMPLETION_PERCENT_THRESHOLD = 90
const COMPLETION_HINT = `At ${COMPLETION_PERCENT_THRESHOLD}% or above, the assignment is marked complete and progress can no longer be edited.`

type LearnerStatus = 'completed' | 'in_progress' | 'not_started'

function learnerStatus(done: boolean, percent: number): LearnerStatus {
  if (done) return 'completed'
  if (percent > 0) return 'in_progress'
  return 'not_started'
}

function StatusChip({ status }: { status: LearnerStatus }) {
  if (status === 'completed') {
    return <span className="status status-ready">completed</span>
  }
  if (status === 'in_progress') {
    return <span className="status status-processing">in progress</span>
  }
  return <span className="status status-queued">not started</span>
}

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="progress-track-wrap">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progress ${clamped}%`}
      >
        <div
          className="progress-track-fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="progress-track-label">{clamped}%</span>
    </div>
  )
}

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
            ? me.email
            : isLearner
              ? 'Your assigned videos'
              : 'Assignments and progress'
        }
      />

      {isStaff ? <StaffTraining /> : null}
      {isLearner ? <LearnerTraining /> : null}
      {!isStaff && !isLearner ? (
        <p className="text-muted text-sm">
          Training is unavailable for this account (no workspace role).
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
  const { showToast } = useToast()

  const [videoId, setVideoId] = useState('')
  const [userId, setUserId] = useState('')

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
    try {
      await createAssignment({
        videoId: Number(videoId),
        userId: Number(userId),
      }).unwrap()
      showToast({ message: 'Assigned.', tone: 'success' })
      setVideoId('')
      setUserId('')
    } catch {
      showToast({
        message: 'Assign failed (need published video + learner in tenant).',
        tone: 'error',
      })
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
  const { showToast } = useToast()
  const [percentByVideo, setPercentByVideo] = useState<Record<number, string>>(
    {},
  )
  const [page, setPage] = useState(1)
  const [watchTarget, setWatchTarget] = useState<{
    videoId: number
    title: string
  } | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const watchProgressFloorRef = useRef(0)

  useEffect(() => {
    setPage(1)
  }, [assignments.length])

  useEffect(() => {
    setPercentByVideo((prev) => {
      let changed = false
      const next = { ...prev }
      for (const p of progress) {
        const server = String(p.percent)
        if (next[p.videoId] !== server) {
          next[p.videoId] = server
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [progress])

  const progressByVideo = useMemo(() => {
    const map = new Map<number, { percent: number; positionSeconds: number }>()
    for (const p of progress) {
      map.set(p.videoId, {
        percent: p.percent,
        positionSeconds: p.positionSeconds ?? 0,
      })
    }
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

  const stats = useMemo(() => {
    let inProgress = 0
    let completed = 0
    for (const a of assignments) {
      const done = completedVideos.has(a.videoId)
      const percent = progressByVideo.get(a.videoId)?.percent ?? 0
      if (done) completed += 1
      else if (percent > 0) inProgress += 1
    }
    return {
      assigned: assignments.length,
      inProgress,
      completed,
      notStarted: Math.max(0, assignments.length - inProgress - completed),
    }
  }, [assignments, completedVideos, progressByVideo])

  const continueAssignment = useMemo(() => {
    const incomplete = sortedAssignments.filter(
      (a) => !completedVideos.has(a.videoId),
    )
    if (incomplete.length === 0) return null
    const withProgress = incomplete
      .map((a) => ({
        assignment: a,
        percent: progressByVideo.get(a.videoId)?.percent ?? 0,
      }))
      .sort((a, b) => b.percent - a.percent || b.assignment.id - a.assignment.id)
    return withProgress[0] ?? null
  }, [sortedAssignments, completedVideos, progressByVideo])

  const pagedAssignments = slicePage(sortedAssignments, page, PAGE_SIZE)

  const watchPercent = watchTarget
    ? (progressByVideo.get(watchTarget.videoId)?.percent ?? 0)
    : 0
  const watchDone = watchTarget
    ? completedVideos.has(watchTarget.videoId)
    : false
  const watchStartAtSeconds =
    watchTarget && !watchDone
      ? (progressByVideo.get(watchTarget.videoId)?.positionSeconds ?? 0)
      : 0
  const watchInitialPercent =
    watchTarget && !watchDone
      ? (progressByVideo.get(watchTarget.videoId)?.percent ?? 0)
      : 0

  useEffect(() => {
    if (!watchTarget) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeWatch()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [watchTarget])

  function closeWatch() {
    setWatchTarget(null)
    setPlaybackUrl(null)
    setPlaybackError(null)
  }

  async function openWatch(assignment: Assignment) {
    const title = assignment.videoTitle ?? `Video #${assignment.videoId}`
    setWatchTarget({ videoId: assignment.videoId, title })
    setPlaybackUrl(null)
    setPlaybackError(null)
    watchProgressFloorRef.current =
      progressByVideo.get(assignment.videoId)?.percent ?? 0
    try {
      const result = await fetchPlayback(assignment.videoId).unwrap()
      setPlaybackUrl(result.url)
    } catch {
      setPlaybackError('Playback is unavailable for this video right now.')
    }
  }

  async function trackWatchProgress(update: {
    percent: number
    positionSeconds: number
  }) {
    if (!watchTarget) return
    if (completedVideos.has(watchTarget.videoId)) return
    const next = Math.max(watchProgressFloorRef.current, update.percent)
    if (next <= watchProgressFloorRef.current && update.percent < 100) return
    watchProgressFloorRef.current = next
    try {
      await upsertProgress({
        videoId: watchTarget.videoId,
        percent: next,
        positionSeconds: update.positionSeconds,
      }).unwrap()
    } catch {
      // keep watching; manual save still available on the list
    }
  }

  async function onReport(videoId: number, title: string) {
    const raw =
      percentByVideo[videoId] ??
      String(progressByVideo.get(videoId)?.percent ?? 0)
    const percent = Number(raw)
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      showToast({
        message: 'Enter a progress value between 0 and 100.',
        tone: 'error',
      })
      return
    }
    try {
      const result = await upsertProgress({
        videoId,
        percent,
        // Manual edits may lower progress; estimate resume near that %.
        positionSeconds: 0,
        allowDecrease: true,
      }).unwrap()
      showToast({
        message: result.completion
          ? `"${title}" marked complete.`
          : `Saved ${result.progress.percent}% on "${title}".`,
        tone: 'success',
      })
    } catch {
      showToast({
        message:
          'Could not save progress. The video may still be processing or unpublished.',
        tone: 'error',
      })
    }
  }

  if (isLoading) {
    return <p className="panel-empty">Loading your assignments…</p>
  }

  return (
    <>
      {assignments.length > 0 ? (
        <div className="learner-stat-strip" aria-label="Training summary">
          <div className="learner-stat">
            <span className="learner-stat-value">{stats.assigned}</span>
            <span className="learner-stat-label">Assigned</span>
          </div>
          <div className="learner-stat">
            <span className="learner-stat-value">{stats.notStarted}</span>
            <span className="learner-stat-label">Not started</span>
          </div>
          <div className="learner-stat">
            <span className="learner-stat-value">{stats.inProgress}</span>
            <span className="learner-stat-label">In progress</span>
          </div>
          <div className="learner-stat">
            <span className="learner-stat-value">{stats.completed}</span>
            <span className="learner-stat-label">Completed</span>
          </div>
        </div>
      ) : null}

      {continueAssignment ? (
        <section className="panel learner-continue">
          <div className="panel-body learner-continue-body">
            <div className="learner-continue-copy">
              <p className="learner-continue-eyebrow">Last played</p>
              <h2 className="learner-continue-title">
                {continueAssignment.assignment.videoTitle ??
                  `Video #${continueAssignment.assignment.videoId}`}
              </h2>
              <div className="learner-continue-meta">
                {continueAssignment.percent > 0 ? (
                  <StatusChip
                    status={learnerStatus(false, continueAssignment.percent)}
                  />
                ) : null}
                <ProgressBar
                  percent={continueAssignment.percent}
                  label="Last played progress"
                />
              </div>
            </div>
            <button
              className="btn btn-primary learner-continue-btn"
              type="button"
              disabled={playbackState.isFetching}
              onClick={() => void openWatch(continueAssignment.assignment)}
            >
              {playbackState.isFetching &&
              playbackState.originalArgs ===
                continueAssignment.assignment.videoId
                ? 'Loading…'
                : 'Continue watching'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel learner-assignments">
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
            <p className="cell-primary mb-2">No assignments yet</p>
            <p className="text-muted text-sm">
              Assigned videos will appear here.
            </p>
          </div>
        ) : (
          <>
            <ul className="learner-assign-list">
              {pagedAssignments.map((a) => {
                const title = a.videoTitle ?? `Video #${a.videoId}`
                const percent = progressByVideo.get(a.videoId)?.percent ?? 0
                const done = completedVideos.has(a.videoId)
                const status = learnerStatus(done, percent)
                const fetchingPlay =
                  playbackState.isFetching &&
                  playbackState.originalArgs === a.videoId &&
                  watchTarget?.videoId === a.videoId

                return (
                  <li key={a.id} className="learner-assign-card">
                    <div className="learner-assign-top">
                      <div className="learner-assign-title-block">
                        <p className="learner-assign-title">{title}</p>
                        <StatusChip status={status} />
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        disabled={fetchingPlay}
                        onClick={() => void openWatch(a)}
                      >
                        {fetchingPlay
                          ? 'Loading…'
                          : done
                            ? 'Rewatch'
                            : percent > 0
                              ? 'Continue'
                              : 'Watch'}
                      </button>
                    </div>
                    <ProgressBar percent={percent} label={`${title} progress`} />
                    {done ? (
                      <p className="cell-secondary text-sm">
                        Progress locked (completed).
                      </p>
                    ) : (
                      <div className="form-row-controls learner-assign-controls">
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
                                showToast({
                                  message: result.completion
                                    ? `"${title}" marked complete.`
                                    : `Saved 100% on "${title}".`,
                                  tone: 'success',
                                })
                              })
                              .catch(() => {
                                showToast({
                                  message:
                                    'Could not save progress. The video may still be processing or unpublished.',
                                  tone: 'error',
                                })
                              })
                          }}
                        >
                          Complete
                        </button>
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
                            <rect
                              x="7.15"
                              y="6.5"
                              width="1.7"
                              height="6"
                              rx="0.85"
                            />
                          </svg>
                        </span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              total={sortedAssignments.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {watchTarget ? (
        <VideoPlayerModal
          title={watchTarget.title}
          playbackUrl={playbackUrl}
          isLoading={playbackState.isFetching}
          error={playbackError}
          startAtSeconds={watchStartAtSeconds}
          initialPercent={watchInitialPercent}
          meta={
            <>
              <StatusChip status={learnerStatus(watchDone, watchPercent)} />
              <ProgressBar
                percent={watchPercent}
                label={`${watchTarget.title} progress`}
              />
            </>
          }
          onProgress={(update) => {
            void trackWatchProgress(update)
          }}
          onClose={closeWatch}
        />
      ) : null}
    </>
  )
}
