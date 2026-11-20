import { useEffect, useMemo } from 'react'
import { resolvePortalBackground } from '../utils/portalBackground.js'
import { fondResponsive, prechargerImage } from '../utils/imageResponsive.js'

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
    const fond = fondResponsive(background.src)
    const retirerPrechargement = prechargerImage(fond.url)
    body.classList.add('portal-bg-active')
    body.style.setProperty('--portal-page-bg', fond.image)
    body.style.setProperty('--portal-page-bg-position', background.position)
    if (background.veil != null) body.style.setProperty('--portal-page-veil', String(background.veil))
    // Permet d'ajuster en CSS une section selon la photo de fond (ex. body[data-portal-bg="rh"]).
    body.dataset.portalBg = background.key

    return () => {
      delete body.dataset.portalBg
      retirerPrechargement()
      body.classList.remove('portal-bg-active')
      body.style.removeProperty('--portal-page-bg')
      body.style.removeProperty('--portal-page-bg-position')
      body.style.removeProperty('--portal-page-veil')
    }
  }, [background, requireUser, user])

  return background
}
