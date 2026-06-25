import { useEffect, useState } from 'react'
import { resolveFabToneAtElement } from '../utils/fabTone.js'

/**
 * Met à jour le ton d'un bouton flottant selon la section traversée au scroll.
 * @param {string} selector - sélecteur CSS de l'élément (ex. `.page-header-close`)
 */
export default function useAdaptiveFabTone(selector) {
  const [tone, setTone] = useState('light')

  useEffect(() => {
    let frame = 0

    const update = () => {
      const el = document.querySelector(selector)
      if (!el) return
      setTone(resolveFabToneAtElement(el, selector))
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [selector])

  return tone
}
