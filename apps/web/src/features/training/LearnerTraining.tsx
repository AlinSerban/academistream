import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PaginationControls,
  slicePage,
} from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useToast } from '../../components/Toast'
import { useLazyGetPlaybackUrlQuery } from '../content/contentApi'
import {
  useGetMyAssignmentsQuery,
  useGetMyCompletionsQuery,
  useGetMyProgressQuery,
  useUpsertProgressMutation,
} from './trainingApi'
import {
  COMPLETION_HINT,
  learnerStatus,
  type Assignment,
} from './types'
import { ProgressBar, StatusChip } from './trainingUi'

const PAGE_SIZE = 5

export function LearnerTraining() {
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
