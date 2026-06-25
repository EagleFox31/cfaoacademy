import { useEffect } from 'react'

/**
 * Slide-out / slide-in du fond hero : l'image monte plus vite que le scroll
 * pour laisser apparaître le fond body (fixed) dans le cadre.
 */
export default function useHeroBgParallax(frameRef, bgRef) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false

    const update = () => {
      const frame = frameRef.current
      const bg = bgRef.current
      if (!frame || !bg) {
        ticking = false
        return
      }

      const rect = frame.getBoundingClientRect()
      const height = Math.max(rect.height, 1)

      // 0 = hero en haut de page, 1 = hero entièrement sorti
      const progress = Math.min(1, Math.max(0, -rect.top / height))
      const slideY = progress * height

      bg.style.transform = `translate3d(0, ${-slideY.toFixed(2)}px, 0)`

      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      const bg = bgRef.current
      if (bg) bg.style.transform = ''
    }
  }, [frameRef, bgRef])
}
