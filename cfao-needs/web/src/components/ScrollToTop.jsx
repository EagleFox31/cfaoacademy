import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { rememberHomeScroll, restoreHomeScroll } from '../lib/homeScroll'

/**
 * Remonte en haut à chaque changement de route — sauf retour sur `/`, où l'on
 * restaure la position mémorisée (ex. retour depuis une fiche marque).
 *
 * Ne pas ré-enregistrer scrollY au montage de `/` : la page est encore en haut
 * et écraserait la position sauvée avant le restore.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (pathname !== '/') return undefined
    const onScroll = () => rememberHomeScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  useEffect(() => {
    const from = prevPath.current
    prevPath.current = pathname

    if (hash) return undefined

    if (pathname === '/' && from !== '/') {
      // clear: false — PolesList relance après chargement du catalogue
      return restoreHomeScroll({ clear: false })
    }

    if (pathname !== '/') {
      window.scrollTo(0, 0)
    }
    return undefined
  }, [pathname, hash])

  return null
}
