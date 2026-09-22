import { useEffect, useRef, useState } from 'react'
import { PaginationControls } from '../../components/PaginationControls'
import { VideoPlayerModal } from '../../components/VideoPlayerModal'
import { useToast } from '../../components/Toast'
import { useLazyGetPlaybackUrlQuery } from '../content/contentApi'
import {
  useGetMyAssignmentsQuery,
  useUpsertProgressMutation,
} from './trainingApi'
import {
  COMPLETION_HINT,
  learnerStatus,
  type MyAssignment,
} from './types'
import { ProgressBar, StatusChip } from './trainingUi'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'

export function LearnerTraining() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useGetMyAssignmentsQuery({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [upsertProgress, upsertState] = useUpsertProgressMutation()
  const [fetchPlayback, playbackState] = useLazyGetPlaybackUrlQuery()
  const { showToast } = useToast()
  const [percentByVideo, setPercentByVideo] = useState<Record<number, string>>(
    {},
  )
  const [watchTarget, setWatchTarget] = useState<{
    videoId: number
    title: string
  } | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const watchProgressFloorRef = useRef(0)

  const assignments = data?.items ?? []
  const stats = data?.stats
  const continueAssignment = data?.continueAssignment ?? null
  const total = data?.total ?? 0

  useEffect(() => {
    setPercentByVideo((prev) => {
      let changed = false
      const next = { ...prev }
      for (const a of assignments) {
        const server = String(a.percent)
        if (next[a.videoId] !== server) {
          next[a.videoId] = server
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [assignments])

  const watchRow = watchTarget
    ? assignments.find((a) => a.videoId === watchTarget.videoId) ??
      (continueAssignment?.videoId === watchTarget.videoId
        ? continueAssignment
        : null)
    : null
  const watchPercent = watchRow?.percent ?? 0
  const watchDone = watchRow?.completed ?? false
  const watchStartAtSeconds =
    watchRow && !watchDone ? watchRow.positionSeconds : 0
  const watchInitialPercent =
    watchRow && !watchDone ? watchRow.percent : 0

  function closeWatch() {
    setWatchTarget(null)
    setPlaybackUrl(null)
    setPlaybackError(null)
  }

  async function openWatch(assignment: MyAssignment) {
    const title = assignment.videoTitle ?? `Video #${assignment.videoId}`
    setWatchTarget({ videoId: assignment.videoId, title })
    setPlaybackUrl(null)
    setPlaybackError(null)
    watchProgressFloorRef.current = assignment.percent
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
    if (watchDone) return
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
    const assignment = assignments.find((a) => a.videoId === videoId)
    const raw =
      percentByVideo[videoId] ?? String(assignment?.percent ?? 0)
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
      {stats && stats.assigned > 0 ? (
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
                {continueAssignment.videoTitle ??
                  `Video #${continueAssignment.videoId}`}
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
              onClick={() => void openWatch(continueAssignment)}
            >
              {playbackState.isFetching &&
              playbackState.originalArgs === continueAssignment.videoId
                ? 'Loading…'
                : 'Continue watching'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel learner-assignments">
        <header className="panel-head">
          <h2 className="panel-title">Assigned videos</h2>
          {total > 0 && stats ? (
            <span className="panel-count">
              {stats.completed}/{stats.assigned} complete
            </span>
          ) : null}
        </header>
        {total === 0 ? (
          <div className="panel-body">
            <p className="cell-primary mb-2">No assignments yet</p>
            <p className="text-muted text-sm">
              Assigned videos will appear here.
            </p>
          </div>
        ) : (
          <>
            <ul className="learner-assign-list">
              {assignments.map((a) => {
                const title = a.videoTitle ?? `Video #${a.videoId}`
                const percent = a.percent
                const done = a.completed
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
              pageSize={DEFAULT_PAGE_SIZE}
              total={total}
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
