import { useEffect, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import { resolveFabToneAtElement } from '../utils/fabTone.js'

const SHOW_AFTER = 480

export default function BackToTopFab() {
  const { t } = useLocale('common')
  const [visible, setVisible] = useState(false)
  const [tone, setTone] = useState('light')

  useEffect(() => {
    let frame = 0

    const update = () => {
      const show = window.scrollY > SHOW_AFTER
      setVisible(show)
      if (show) {
        const fab = document.querySelector('.back-to-top-fab')
        setTone(resolveFabToneAtElement(fab, '.back-to-top-fab'))
      }
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
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const id = requestAnimationFrame(() => {
      const fab = document.querySelector('.back-to-top-fab')
      setTone(resolveFabToneAtElement(fab, '.back-to-top-fab'))
    })
    return () => cancelAnimationFrame(id)
  }, [visible])

  return (
    <button
      type="button"
      className={[
        'back-to-top-fab',
        visible && 'is-visible',
        tone === 'dark' && 'back-to-top-fab--on-dark',
      ].filter(Boolean).join(' ')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t.backToTopAria}
    >
      <span className="back-to-top-fab-label">{t.backToTop}</span>
      <span className="back-to-top-fab-icon" aria-hidden="true">↑</span>
    </button>
  )
}
