import { useCallback, useEffect, useRef, useState } from 'react'
import { CARD_VIDEO_PREVIEW_MS, getCardHoverPreview } from '../utils/videoEmbed.js'

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function resolvePosterChain(preview, siteFallback) {
  const articleImage = preview?.fallbackImage || preview?.image || null
  return {
    remoteThumb: preview?.type === 'video' ? preview?.thumbnail : null,
    articleImage,
    siteFallback,
  }
}

function initialPosterSrc(preview, siteFallback) {
  if (!preview || preview.type !== 'video') {
    return preview?.image || siteFallback
  }
  return preview.fallbackImage || preview.image || siteFallback
}

/** Visuel carte article : vignette + ~5 s de vidéo au survol (muet), avec repli image article. */
export default function ArticleCardMedia({ preview, fallback = '/assets/logo-cfao-mobility.jpg' }) {
  const [playing, setPlaying] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [posterSrc, setPosterSrc] = useState(() => initialPosterSrc(preview, fallback))
  const [hoverEnabled, setHoverEnabled] = useState(true)
  const timerRef = useRef(null)
  const videoRef = useRef(null)

  const isVideo = preview?.type === 'video'
  const videoUrl = preview?.videoUrl
  const { remoteThumb, articleImage, siteFallback } = resolvePosterChain(preview, fallback)
  const hoverPreview = isVideo && videoUrl && hoverEnabled
    ? getCardHoverPreview(videoUrl)
    : null

  useEffect(() => {
    if (!isVideo) {
      setPosterSrc(preview?.image || siteFallback)
      setHoverEnabled(true)
      return undefined
    }

    const nextPoster = articleImage || siteFallback
    if (!remoteThumb) {
      setPosterSrc(nextPoster)
      setHoverEnabled(true)
      return undefined
    }

    let cancelled = false
    const probe = new Image()
    probe.onload = () => {
      if (cancelled) return
      setPosterSrc(remoteThumb)
      setHoverEnabled(true)
    }
    probe.onerror = () => {
      if (cancelled) return
      setPosterSrc(nextPoster)
      const hover = getCardHoverPreview(videoUrl)
      setHoverEnabled(hover?.kind !== 'iframe')
    }
    probe.src = remoteThumb

    return () => {
      cancelled = true
    }
  }, [isVideo, remoteThumb, articleImage, siteFallback, videoUrl, preview?.image])

  const stopPreview = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
    const el = videoRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
  }, [])

  const disableHoverPreview = useCallback(() => {
    setHoverEnabled(false)
    stopPreview()
  }, [stopPreview])

  const startPreview = useCallback(() => {
    if (!hoverPreview) return
    stopPreview()
    setPlaying(true)
    setIframeKey((k) => k + 1)
    timerRef.current = window.setTimeout(stopPreview, CARD_VIDEO_PREVIEW_MS)
  }, [hoverPreview, stopPreview])

  const handlePosterError = useCallback(() => {
    if (posterSrc === articleImage && articleImage) return
    if (articleImage && posterSrc !== articleImage) {
      setPosterSrc(articleImage)
      return
    }
    if (posterSrc !== siteFallback) setPosterSrc(siteFallback)
  }, [posterSrc, articleImage, siteFallback])

  const handleVideoError = useCallback(() => {
    disableHoverPreview()
  }, [disableHoverPreview])

  useEffect(() => {
    if (!playing || hoverPreview?.kind !== 'file') return
    const el = videoRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(handleVideoError)
  }, [playing, hoverPreview, iframeKey, handleVideoError])

  useEffect(() => () => stopPreview(), [stopPreview])

  if (!isVideo) {
    return (
      <div className="pv-card-img">
        <img
          src={posterSrc || preview?.image || siteFallback}
          alt=""
          loading="lazy"
          onError={handlePosterError}
        />
      </div>
    )
  }

  const showPlayBadge = hoverEnabled && Boolean(hoverPreview)

  return (
    <div
      className={`pv-card-img pv-card-img--video-preview${playing ? ' is-playing' : ''}`}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
    >
      <img
        src={posterSrc || articleImage || siteFallback}
        alt=""
        loading="lazy"
        className="pv-card-video-poster"
        onError={handlePosterError}
      />
      {playing && hoverPreview?.kind === 'iframe' && (
        <iframe
          key={iframeKey}
          className="pv-card-video-preview-layer"
          src={hoverPreview.url}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          loading="lazy"
        />
      )}
      {playing && hoverPreview?.kind === 'file' && (
        <video
          ref={videoRef}
          className="pv-card-video-preview-layer"
          src={hoverPreview.url}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onError={handleVideoError}
        />
      )}
      {!playing && showPlayBadge && (
        <span className="pv-card-video-play" aria-hidden="true">
          <PlayIcon />
        </span>
      )}
    </div>
  )
}
