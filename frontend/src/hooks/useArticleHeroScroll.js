import { useEffect } from 'react'

const SCROLL_DELAY_MS = 120

/** Scroll léger vers la vidéo hero après navigation (après ScrollToTop). */
export default function useArticleHeroScroll(heroVideoSrc, slug) {
  useEffect(() => {
    if (!heroVideoSrc) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduced ? 0 : SCROLL_DELAY_MS

    const timer = window.setTimeout(() => {
      const hero = document.querySelector('.article-hero--video')
      if (!hero) return

      const navH =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76
      const rect = hero.getBoundingClientRect()
      const target = window.scrollY + rect.top - navH - 24

      window.scrollTo({
        top: Math.max(0, target),
        behavior: reduced ? 'auto' : 'smooth',
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [heroVideoSrc, slug])
}
