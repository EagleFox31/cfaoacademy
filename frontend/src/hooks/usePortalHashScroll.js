import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function scrollToHashSection(id, behavior = 'smooth') {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior, block: 'start' })
  return true
}

/** Scroll vers l’ancre portail (#resultats, #pif…) une fois le dashboard monté. */
export default function usePortalHashScroll(enabled) {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!enabled || pathname !== '/portail') return undefined

    const id = hash?.replace(/^#/, '')
    if (!id) return undefined

    let cancelled = false
    const delays = [0, 50, 150, 400, 900, 1500]
    const timers = delays.map(delay =>
      window.setTimeout(() => {
        if (!cancelled) scrollToHashSection(id)
      }, delay),
    )

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [enabled, pathname, hash])
}
