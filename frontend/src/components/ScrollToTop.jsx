import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Remonte en haut à chaque changement de page (React Router ne le fait pas par défaut). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
