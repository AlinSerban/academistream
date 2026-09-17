import { useEffect, type ReactNode } from 'react'
import {
  ThemedVideoPlayer,
  type WatchProgressUpdate,
} from './ThemedVideoPlayer'

function isBrowserPlayableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export function VideoPlayerModal({
  title,
  subtitle,
  playbackUrl,
  isLoading = false,
  error = null,
  meta,
  autoPlay = true,
  startAtSeconds = 0,
  initialPercent = 0,
  onProgress,
  onClose,
}: {
  title: string
  subtitle?: string
  playbackUrl: string | null
  isLoading?: boolean
  error?: string | null
  meta?: ReactNode
  autoPlay?: boolean
  startAtSeconds?: number
  initialPercent?: number
  onProgress?: (update: WatchProgressUpdate) => void
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const playable =
    playbackUrl != null && isBrowserPlayableUrl(playbackUrl)

  return (
    <div
      className="watch-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="watch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-modal-title"
      >
        <div className="watch-modal-stage">
          <button
            className="watch-modal-close"
            type="button"
            aria-label="Close player"
            onClick={onClose}
          >
            <CloseIcon />
          </button>

          <div className="watch-modal-stage-inner">
            {isLoading && !playbackUrl && !error ? (
              <div className="watch-modal-status" role="status">
                <span className="watch-modal-spinner" aria-hidden="true" />
                <p>Loading playback…</p>
              </div>
            ) : null}

            {error ? (
              <p className="watch-modal-status watch-modal-status-error">
                {error}
              </p>
            ) : null}

            {playable ? (
              <ThemedVideoPlayer
                src={playbackUrl}
                autoPlay={autoPlay}
                startAtSeconds={startAtSeconds}
                initialPercent={initialPercent}
                onProgress={onProgress}
              />
            ) : null}

            {playbackUrl && !playable ? (
              <p className="watch-modal-status">
                Inline playback needs an HTTPS media URL. Retry after the
                demo media pipeline finishes, or open this video from a
                desktop browser once storage is configured for signed HTTPS.
              </p>
            ) : null}
          </div>
        </div>

        <div className="watch-modal-caption">
          <div className="watch-modal-caption-row">
            <h2 id="watch-modal-title" className="watch-modal-title">
              {title}
            </h2>
            {subtitle ? (
              <p className="watch-modal-subtitle">{subtitle}</p>
            ) : null}
          </div>
          {meta ? <div className="watch-modal-meta">{meta}</div> : null}
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 6.5l11 11M17.5 6.5l-11 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
