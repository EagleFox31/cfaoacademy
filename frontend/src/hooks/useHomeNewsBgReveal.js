import { useEffect } from 'react'

const MAX_BLUR_PX = 22

/**
 * Sous le hero : aperçu de la photo Actualités (section-bg locale) floutée.
 * Au scroll, le flou et le voile blanc diminuent jusqu’à la netteté.
 * N’affecte pas le hero ni le HomeBackdrop.
 */
export default function useHomeNewsBgReveal(containerRef, heroVisible) {
  useEffect(() => {
    const root = containerRef.current
    const hero = document.getElementById('accueil')
    const news = document.getElementById('actualites')
    if (!root || !news) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = () => {
      if (!heroVisible || reducedMotion.matches) {
        root.style.setProperty('--news-bg-blur', '0px')
        root.style.setProperty('--news-bg-reveal', '1')
        return
      }

      const newsRect = news.getBoundingClientRect()
      const heroRect = hero?.getBoundingClientRect()
      const startTop = heroRect ? heroRect.bottom : window.innerHeight * 0.75
      const endTop = 88
      const range = Math.max(160, startTop - endTop)
      const progress = Math.min(1, Math.max(0, (startTop - newsRect.top) / range))
      const blur = (1 - progress) * MAX_BLUR_PX

      root.style.setProperty('--news-bg-blur', `${blur.toFixed(2)}px`)
      root.style.setProperty('--news-bg-reveal', progress.toFixed(3))
    }

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    reducedMotion.addEventListener('change', update)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      reducedMotion.removeEventListener('change', update)
      root.style.removeProperty('--news-bg-blur')
      root.style.removeProperty('--news-bg-reveal')
    }
  }, [containerRef, heroVisible])
}
