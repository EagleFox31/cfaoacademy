import { useCallback, useEffect, useState } from 'react'
import { isVideoFile } from '../utils/videoEmbed.js'

/**
 * Hero article : lecture fluide avec son activé par défaut + miniature flottante à droite au scroll.
 * La vidéo persiste sans interruption ni rechargement (zéro redémarrage).
 */
export function useArticleHeroVideo({
  figureRef,
  videoRef,
  url,
  autoPlay = false,
  floatOnScroll = false,
}) {
  const [floating, setFloating] = useState(false)
  const [floatDismissed, setFloatDismissed] = useState(false)
  const [videoEl, setVideoEl] = useState(null)

  const bindVideoRef = useCallback(
    (node) => {
      videoRef.current = node
      setVideoEl(node)
    },
    [videoRef],
  )

  // ── Initialisation volume & son (NON MUTÉ par défaut) ─────────────
  useEffect(() => {
    if (!isVideoFile(url) || !videoEl) return undefined

    let cancelled = false

    // Le volume par défaut ne doit pas être mute
    videoEl.muted = false
    videoEl.volume = 1

    const tryPlay = async () => {
      try {
        await videoEl.play()
        if (cancelled) videoEl.pause()
      } catch {
        // Si le navigateur bloque l'autoplay non-muté sans interaction préalable,
        // on ne bascule JAMAIS en muet forcé : on conserve muted = false et volume = 1.
        // Dès que l'utilisateur clique sur lecture, le son est immédiatement actif à 100%.
      }
    }

    if (autoPlay) {
      if (videoEl.readyState >= 2) tryPlay()
      else videoEl.addEventListener('canplay', tryPlay, { once: true })
    }

    return () => {
      cancelled = true
    }
  }, [url, autoPlay, videoEl])

  // ── Détection du défilement pour la miniature à droite au scroll ──
  useEffect(() => {
    if (!floatOnScroll || !isVideoFile(url)) return undefined
    const figure = figureRef.current
    if (!figure) return undefined

    const checkFloat = () => {
      const rect = figure.getBoundingClientRect()
      const navH = 76
      // Dès que le bas du hero passe sous ou approche la barre de navigation, la miniature s'active
      const scrolledPast = rect.bottom < navH + 80

      if (scrolledPast) {
        if (!floatDismissed) {
          setFloating(true)
        }
      } else {
        setFloating(false)
        setFloatDismissed(false)
      }
    }

    window.addEventListener('scroll', checkFloat, { passive: true })
    window.addEventListener('resize', checkFloat, { passive: true })
    checkFloat()

    return () => {
      window.removeEventListener('scroll', checkFloat)
      window.removeEventListener('resize', checkFloat)
    }
  }, [url, floatOnScroll, floatDismissed, figureRef])

  const dismissFloat = useCallback(() => {
    setFloatDismissed(true)
    setFloating(false)
  }, [])

  return { floating, dismissFloat, bindVideoRef }
}
