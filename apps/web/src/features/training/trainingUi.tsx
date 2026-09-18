import type { LearnerStatus } from './types'

export function StatusChip({ status }: { status: LearnerStatus }) {
  if (status === 'completed') {
    return <span className="status status-ready">completed</span>
  }
  if (status === 'in_progress') {
    return <span className="status status-processing">in progress</span>
  }
  return <span className="status status-queued">not started</span>
}

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
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
