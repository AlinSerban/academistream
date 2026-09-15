import { useEffect, useRef, useState, type CSSProperties } from 'react'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export type WatchProgressUpdate = {
  percent: number
  positionSeconds: number
}

export function ThemedVideoPlayer({
  src,
  autoPlay = true,
  startAtSeconds = 0,
  initialPercent = 0,
  onProgress,
}: {
  src: string
  autoPlay?: boolean
  /** Resume playback near this timestamp when metadata is ready. */
  startAtSeconds?: number
  /** Known saved percent so early progress reports don't go backwards. */
  initialPercent?: number
  /** Called as watch position advances (throttled). */
  onProgress?: (update: WatchProgressUpdate) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const onProgressRef = useRef(onProgress)
  const startAtRef = useRef(startAtSeconds)
  const didSeekRef = useRef(false)
  const lastReportedRef = useRef(0)
  const lastReportAtRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    startAtRef.current = startAtSeconds
    didSeekRef.current = false
    lastReportedRef.current = Math.max(0, Math.min(100, Math.round(initialPercent)))
    lastReportAtRef.current = 0
  }, [src, startAtSeconds, initialPercent])

  function reportProgress(
    percent: number,
    positionSeconds: number,
    force = false,
  ) {
    const cb = onProgressRef.current
    if (!cb) return
    const next = Math.max(0, Math.min(100, Math.round(percent)))
    const pos = Math.max(0, Math.round(positionSeconds))
    const now = Date.now()
    const jumped = next >= lastReportedRef.current + 5
    const timedOut = now - lastReportAtRef.current >= 4000
    if (!force && next <= lastReportedRef.current) return
    if (!force && !jumped && !timedOut && next < 100) return
    lastReportedRef.current = next
    lastReportAtRef.current = now
    cb({ percent: next, positionSeconds: pos })
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function applyResumeSeek() {
      if (didSeekRef.current || !video) return
      const d = video.duration
      if (!Number.isFinite(d) || d <= 0) return
      let target = startAtRef.current
      if (!(target > 0) && lastReportedRef.current > 0 && lastReportedRef.current < 95) {
        target = (lastReportedRef.current / 100) * d
      }
      if (!(target > 0) || lastReportedRef.current >= 95) {
        didSeekRef.current = true
        return
      }
      // Leave a little headroom so "continue" doesn't land on the very end.
      video.currentTime = Math.min(target, Math.max(0, d - 1))
      setCurrent(video.currentTime)
      didSeekRef.current = true
    }

    function onPlay() {
      setPlaying(true)
      const t = video?.currentTime ?? 0
      const d = video?.duration ?? 0
      const pct = d > 0 ? (t / d) * 100 : Math.max(1, lastReportedRef.current)
      reportProgress(Math.max(1, pct), t, true)
    }
    function onPause() {
      setPlaying(false)
      const d = video?.duration ?? 0
      const t = video?.currentTime ?? 0
      if (d > 0) reportProgress((t / d) * 100, t, true)
    }
    function onTimeUpdate() {
      const t = video?.currentTime ?? 0
      setCurrent(t)
      const d = video?.duration ?? 0
      if (d > 0) reportProgress((t / d) * 100, t)
    }
    function onEnded() {
      const d = video?.duration ?? 0
      reportProgress(100, d, true)
    }
    function onLoaded() {
      setDuration(video?.duration ?? 0)
      applyResumeSeek()
    }
    function onVolume() {
      setMuted(Boolean(video?.muted || video?.volume === 0))
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('durationchange', onLoaded)
    video.addEventListener('volumechange', onVolume)

    if (video.readyState >= 1) {
      applyResumeSeek()
    }

    if (autoPlay) {
      void video.play().catch(() => {
        setPlaying(false)
      })
    }

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('durationchange', onLoaded)
      video.removeEventListener('volumechange', onVolume)
    }
  }, [src, autoPlay])

  useEffect(() => {
    function onFsChange() {
      const active =
        document.fullscreenElement === rootRef.current ||
        document.fullscreenElement === videoRef.current
      setFullscreen(active)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  function bumpControls() {
    setControlsVisible(true)
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
    }
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false)
      }, 2200)
    }
  }

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      await video.play().catch(() => undefined)
    } else {
      video.pause()
    }
    bumpControls()
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
    bumpControls()
  }

  function onSeek(value: number) {
    const video = videoRef.current
    if (!video || !Number.isFinite(value)) return
    video.currentTime = value
    setCurrent(value)
    bumpControls()
  }

  async function toggleFullscreen() {
    const root = rootRef.current
    if (!root) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await root.requestFullscreen()
      }
    } catch {
      // browser may block fullscreen without gesture
    }
    bumpControls()
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div
      ref={rootRef}
      className={`themed-player${controlsVisible || !playing ? ' is-controls-visible' : ''}`}
      tabIndex={0}
      onMouseMove={bumpControls}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
          e.preventDefault()
          e.stopPropagation()
          void togglePlay()
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault()
          toggleMute()
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          void toggleFullscreen()
        }
      }}
    >
      <video
        ref={videoRef}
        className="themed-player-video"
        src={src}
        preload="metadata"
        playsInline
        onClick={() => void togglePlay()}
      >
        Your browser does not support inline video playback.
      </video>

      {!playing ? (
        <button
          className="themed-player-big-play"
          type="button"
          aria-label="Play"
          onClick={() => void togglePlay()}
        >
          <PlayIcon />
        </button>
      ) : null}

      <div className="themed-player-chrome" aria-hidden={!controlsVisible && playing}>
        <div className="themed-player-scrub">
          <input
            className="themed-player-range"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Number.isFinite(current) ? current : 0}
            aria-label="Seek"
            style={{ '--progress': `${progress}%` } as CSSProperties}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
        </div>
        <div className="themed-player-bar">
          <button
            className="themed-player-btn"
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => void togglePlay()}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            className="themed-player-btn"
            type="button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={toggleMute}
          >
            {muted ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <span className="themed-player-time">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <button
            className="themed-player-btn themed-player-btn-end"
            type="button"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <ExitFsIcon /> : <FsIcon />}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4zm11.5 1.2a3.2 3.2 0 0 1 0 2.6l-1.2-.7a1.8 1.8 0 0 0 0-1.2l1.2-.7zm2.1-2.5a6.2 6.2 0 0 1 0 7.6l-1.2-.8a4.7 4.7 0 0 0 0-6l1.2-.8z" />
    </svg>
  )
}

function MuteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4zm15.2-.7 1.3 1.3-2 2 2 2-1.3 1.3-2-2-2 2-1.3-1.3 2-2-2-2 1.3-1.3 2 2 2-2z" />
    </svg>
  )
}

function FsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9V4h5v2H6v3H4zm10-5h5v5h-2V6h-3V4zM4 15h2v3h3v2H4v-5zm16 0v5h-5v-2h3v-3h2z" />
    </svg>
  )
}

function ExitFsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 4H7v3H4v2h5V4zm10 3h-3V4h-2v5h5V7zM7 17v3h2v-5H4v2h3zm10 0h3v-2h-5v5h2v-3z" />
    </svg>
  )
}
