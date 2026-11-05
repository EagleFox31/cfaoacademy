import { useEffect, useState } from 'react'
import { isVideoFile } from './videoEmbed.js'

/** Seconde cible pour la vignette des MP4 locaux (carte + hero article). */
export const VIDEO_FRAME_POSTER_SEC = 8

const frameCache = new Map()

function seekTime(video, timeSec) {
  const duration = Number.isFinite(video.duration) ? video.duration : timeSec
  if (duration <= 0) return 0
  return Math.min(timeSec, Math.max(0, duration - 0.05))
}

/** Extrait une frame JPEG (data URL) depuis un fichier vidéo hébergé. */
export function captureVideoFrame(url, timeSec = VIDEO_FRAME_POSTER_SEC) {
  const raw = (url ?? '').trim()
  if (!raw || !isVideoFile(raw)) {
    return Promise.reject(new Error('not a video file'))
  }

  const key = `${raw}@${timeSec}`
  if (frameCache.has(key)) return frameCache.get(key)

  const promise = new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const fail = () => {
      video.removeAttribute('src')
      video.load()
      reject(new Error('video frame capture failed'))
    }

    video.addEventListener('error', fail, { once: true })

    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = seekTime(video, timeSec)
      },
      { once: true },
    )

    video.addEventListener(
      'seeked',
      () => {
        try {
          const w = video.videoWidth
          const h = video.videoHeight
          if (!w || !h) {
            fail()
            return
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(video, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        } catch {
          fail()
        } finally {
          video.removeAttribute('src')
          video.load()
        }
      },
      { once: true },
    )

    video.src = raw
  })

  frameCache.set(key, promise)
  promise.catch(() => frameCache.delete(key))
  return promise
}

/** Vignette auto pour MP4 locaux ; null si URL absente ou non-fichier. */
export function useVideoFramePoster(url, timeSec = VIDEO_FRAME_POSTER_SEC, enabled = true) {
  const [poster, setPoster] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || !url || !isVideoFile(url)) {
      setPoster(null)
      setFailed(false)
      return undefined
    }

    let cancelled = false
    setPoster(null)
    setFailed(false)

    captureVideoFrame(url, timeSec)
      .then((dataUrl) => {
        if (!cancelled) setPoster(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [url, timeSec, enabled])

  return { poster, failed }
}
