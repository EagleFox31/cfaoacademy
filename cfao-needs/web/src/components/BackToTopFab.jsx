import { useCallback, useEffect, useState } from 'react'

import { useLocale } from '../i18n'

/** Seuil par défaut : en dessous, la page tient à l'écran sans scroll utile. */
const SHOW_AFTER_PX = 280

/**
 * Bouton flottant « remonter en haut » — même parti pris que la vitrine
 * (`frontend/src/components/BackToTopFab.jsx`), simplifié pour l'app Needs :
 * fond photo clair partout, pas de bascule de ton sur sections sombres.
 *
 * Monté une fois dans `App.jsx` : toutes les pages en héritent sans le recopier.
 */
export default function BackToTopFab({ showAfterPx = SHOW_AFTER_PX }) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)

  const update = useCallback(() => {
    setVisible(window.scrollY > showAfterPx)
  }, [showAfterPx])

  useEffect(() => {
    update()
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [update])

  function scrollTop() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'
    window.scrollTo({ top: 0, behavior })
  }

  return (
    <button
      type="button"
      className={`back-to-top-fab${visible ? ' is-visible' : ''}`}
      onClick={scrollTop}
      aria-label={t('app.backToTopAria')}
    >
      <span className="back-to-top-fab__label">{t('app.backToTop')}</span>
      <span className="back-to-top-fab__icon" aria-hidden="true">↑</span>
    </button>
  )
}
