import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import '../styles/player.css'

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5]

const CustomVideoPlayer = forwardRef(function CustomVideoPlayer(
  {
    src,
    title = 'Vidéo CFAO Academy',
    poster,
    autoPlay = false,
    isFloating = false,
    onExpand,
  },
  forwardedRef,
) {
  const localVideoRef = useRef(null)
  const containerRef = useRef(null)
  const timelineRef = useRef(null)

  // Attach forwardedRef + localVideoRef
  const setVideoRef = useCallback(
    (node) => {
      localVideoRef.current = node
      if (node) {
        node.muted = false
        if (node.volume === 0) node.volume = 1
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef],
  )

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [hoverTime, setHoverTime] = useState(null)
  const [hoverPos, setHoverPos] = useState(0)
  const [osd, setOsd] = useState(null) // { label, icon, key }

  const idleTimerRef = useRef(null)
  const osdTimerRef = useRef(null)

  const showOsd = useCallback((label, icon) => {
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current)
    setOsd({ label, icon, key: Date.now() })
    osdTimerRef.current = setTimeout(() => {
      setOsd(null)
    }, 700)
  }, [])

  // ── Réinitialiser le timer d'inactivité ─────────────────────────────
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (isPlaying) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true)
      }, 2500)
    }
  }, [isPlaying])

  const handleMouseMove = () => {
    resetIdleTimer()
  }

  // ── Commandes de lecture ───────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = localVideoRef.current
    if (!v) return
    v.muted = false
    setIsMuted(false)
    if (v.paused || v.ended) {
      v.play().catch(() => {})
      showOsd('Lecture', 'play')
    } else {
      v.pause()
      showOsd('Pause', 'pause')
    }
  }, [showOsd])

  const seekRelative = useCallback((deltaSec) => {
    const v = localVideoRef.current
    if (!v) return
    const newTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec))
    v.currentTime = newTime
    setCurrentTime(newTime)
    const sign = deltaSec > 0 ? `+${deltaSec}s` : `${deltaSec}s`
    showOsd(sign, deltaSec > 0 ? 'forward' : 'rewind')
  }, [showOsd])

  const toggleMute = useCallback(() => {
    const v = localVideoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
    showOsd(v.muted ? 'Muet' : 'Son activé', v.muted ? 'mute' : 'volume')
  }, [showOsd])

  const changeVolume = useCallback((newVol) => {
    const v = localVideoRef.current
    if (!v) return
    const clamped = Math.max(0, Math.min(1, newVol))
    v.volume = clamped
    v.muted = clamped === 0
    setVolume(clamped)
    setIsMuted(v.muted)
    showOsd(`${Math.round(clamped * 100)}%`, clamped === 0 ? 'mute' : 'volume')
  }, [showOsd])

  const cycleSpeed = useCallback(() => {
    const v = localVideoRef.current
    if (!v) return
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    const nextSpeed = SPEED_OPTIONS[nextIndex]
    v.playbackRate = nextSpeed
    setPlaybackRate(nextSpeed)
    showOsd(`Vitesse ${nextSpeed}x`, 'speed')
  }, [playbackRate, showOsd])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  // ── Écouteurs clavier (Flèches, Espace, J, L, M, F) ─────────────────
  const handleKeyDown = useCallback(
    (e) => {
      // Ignorer si l'utilisateur est dans un input ou textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekRelative(e.shiftKey ? -30 : -10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekRelative(e.shiftKey ? 30 : 10)
          break
        case 'j':
        case 'J':
          e.preventDefault()
          seekRelative(-10)
          break
        case 'l':
        case 'L':
          e.preventDefault()
          seekRelative(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(volume + 0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(volume - 0.1)
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFullscreen()
          break
        default:
          break
      }
    },
    [togglePlay, seekRelative, changeVolume, volume, toggleMute, toggleFullscreen],
  )

  // ── Synchronisation événements vidéo ────────────────────────────────
  useEffect(() => {
    const v = localVideoRef.current
    if (!v) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => {
      setIsPlaying(false)
      setIsIdle(false)
    }
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime)
      if (v.buffered && v.buffered.length > 0) {
        setBufferedEnd(v.buffered.end(v.buffered.length - 1))
      }
    }
    const onLoadedMetadata = () => {
      setDuration(v.duration || 0)
      v.muted = false
      if (v.volume === 0) v.volume = 1
      setVolume(v.volume || 1)
      setIsMuted(false)
    }
    const onVolumeChange = () => {
      setVolume(v.volume)
      setIsMuted(v.muted)
    }

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('loadedmetadata', onLoadedMetadata)
    v.addEventListener('volumechange', onVolumeChange)

    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('loadedmetadata', onLoadedMetadata)
      v.removeEventListener('volumechange', onVolumeChange)
    }
  }, [])

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Timeline drag & hover ───────────────────────────────────────────
  const handleTimelineClick = (e) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const target = pos * duration
    if (localVideoRef.current) {
      localVideoRef.current.currentTime = target
      setCurrentTime(target)
    }
  }

  const handleTimelineMouseMove = (e) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverPos(e.clientX - rect.left)
    setHoverTime(pos * duration)
  }

  const handleTimelineMouseLeave = () => {
    setHoverTime(null)
  }

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={`cfao-player${isPlaying ? ' cfao-player--playing' : ' cfao-player--paused'}${
        isIdle ? ' cfao-player--idle' : ''
      }${isFloating ? ' cfao-player--floating' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={resetIdleTimer}
      aria-label={title}
      role="region"
    >
      <video
        ref={setVideoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        preload={autoPlay ? 'auto' : 'metadata'}
        className="cfao-player-video"
        onClick={togglePlay}
      />

      {/* ── OSD HUD animée ────────────────────────────────────────────── */}
      {osd && (
        <div key={osd.key} className="cfao-player-osd" aria-live="polite">
          <div className="cfao-player-osd-icon">
            {osd.icon === 'forward' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M13 19l6-7-6-7" />
                <path d="M5 19l6-7-6-7" />
              </svg>
            )}
            {osd.icon === 'rewind' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 19l-6-7 6-7" />
                <path d="M19 19l-6-7 6-7" />
              </svg>
            )}
            {osd.icon === 'play' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            {osd.icon === 'pause' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
            {osd.icon === 'volume' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
            {osd.icon === 'mute' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            {osd.icon === 'speed' && (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <span className="cfao-player-osd-label">{osd.label}</span>
        </div>
      )}

      {/* ── Bouton lecture centrale quand en pause ─────────────────────── */}
      {!isPlaying && (
        <button
          type="button"
          className="cfao-player-bigplay"
          onClick={togglePlay}
          aria-label="Lire la vidéo"
        >
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* ── Overlay avec titre en haut et contrôles en bas ─────────────── */}
      <div className="cfao-player-overlay">
        <div className="cfao-player-topbar">
          <p className="cfao-player-title">{title}</p>
        </div>

        <div className="cfao-player-controls" onClick={(e) => e.stopPropagation()}>
          {/* Timeline / Scrubber */}
          <div
            ref={timelineRef}
            className="cfao-player-timeline-wrap"
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            role="slider"
            aria-label="Position dans la vidéo"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            tabIndex={0}
          >
            <div className="cfao-player-timeline">
              <div
                className="cfao-player-progress-buffered"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="cfao-player-progress-played"
                style={{ width: `${playedPct}%` }}
              />
              <div
                className="cfao-player-thumb"
                style={{ left: `${playedPct}%` }}
              />
            </div>
            {hoverTime !== null && (
              <div className="cfao-player-tooltip" style={{ left: `${hoverPos}px` }}>
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Barre des boutons */}
          <div className="cfao-player-bar">
            <div className="cfao-player-bar-left">
              {/* Play / Pause */}
              <button
                type="button"
                className="cfao-player-btn"
                onClick={togglePlay}
                title={isPlaying ? 'Pause (Espace / K)' : 'Lecture (Espace / K)'}
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Bouton Reculer de 30s */}
              <button
                type="button"
                className="cfao-player-btn cfao-player-btn--skip"
                onClick={() => seekRelative(-30)}
                title="Reculer de 30 secondes (ou Shift + ←)"
                aria-label="Reculer de 30 secondes"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <text
                    x="12"
                    y="15.5"
                    textAnchor="middle"
                    fill="currentColor"
                    stroke="none"
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    30
                  </text>
                </svg>
              </button>

              {/* Bouton Avancer de 30s */}
              <button
                type="button"
                className="cfao-player-btn cfao-player-btn--skip"
                onClick={() => seekRelative(30)}
                title="Avancer de 30 secondes (ou Shift + →)"
                aria-label="Avancer de 30 secondes"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <text
                    x="12"
                    y="15.5"
                    textAnchor="middle"
                    fill="currentColor"
                    stroke="none"
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    30
                  </text>
                </svg>
              </button>

              {/* Volume */}
              <div className="cfao-player-volume-group">
                <button
                  type="button"
                  className="cfao-player-btn"
                  onClick={toggleMute}
                  title={isMuted ? 'Activer le son (M)' : 'Couper le son (M)'}
                  aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                >
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <div className="cfao-player-volume-slider-wrap">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => changeVolume(parseFloat(e.target.value))}
                    className="cfao-player-volume-slider"
                    aria-label="Volume"
                  />
                </div>
              </div>

              {/* Temps */}
              <span className="cfao-player-time">
                {formatTime(currentTime)}
                <span className="cfao-player-time-total"> / {formatTime(duration)}</span>
              </span>
            </div>

            <div className="cfao-player-bar-right">
              {/* Bouton Agrandir (visible en mode miniature) */}
              {isFloating && (
                <button
                  type="button"
                  className="cfao-player-btn cfao-player-expand-btn"
                  onClick={onExpand}
                  title="Revenir à la vue principale"
                  aria-label="Agrandir la vidéo"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              )}

              {/* Vitesse de lecture */}
              <button
                type="button"
                className="cfao-player-btn cfao-player-speed-btn"
                onClick={cycleSpeed}
                title="Changer la vitesse de lecture"
                aria-label={`Vitesse actuelle ${playbackRate}x`}
              >
                {playbackRate}x
              </button>

              {/* Plein écran */}
              <button
                type="button"
                className="cfao-player-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}
                aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default CustomVideoPlayer
