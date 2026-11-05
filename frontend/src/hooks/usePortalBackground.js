import { useEffect, useMemo } from 'react'
import { resolvePortalBackground } from '../utils/portalBackground.js'

/**
 * Applique le fond d'écran hero sur `body` pour le portail (photo + voile blanc), restauré au démontage.
 * @param {object | null | undefined} user
 * @param {{ requireUser?: boolean }} [options]
 */
export default function usePortalBackground(user, { requireUser = false } = {}) {
  const background = useMemo(() => resolvePortalBackground(user), [user])

  useEffect(() => {
    if (requireUser && !user) return undefined

    const body = document.body
    body.classList.add('portal-bg-active')
    body.style.setProperty('--portal-page-bg', `url('${background.src}')`)
    body.style.setProperty('--portal-page-bg-position', background.position)

    return () => {
      body.classList.remove('portal-bg-active')
      body.style.removeProperty('--portal-page-bg')
      body.style.removeProperty('--portal-page-bg-position')
    }
  }, [background, requireUser, user])

  return background
}
