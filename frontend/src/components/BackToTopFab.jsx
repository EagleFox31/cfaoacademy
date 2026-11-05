import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useLocale from '../hooks/useLocale.js'
import { resolveFabToneAtElement } from '../utils/fabTone.js'

/** Sous la navbar sticky (~76px) + marge de lecture */
const NAV_CLEARANCE = 84
const SHOW_AFTER_FALLBACK_PX = 280

/** Première ancre « hero » trouvée — ordre = priorité page. */
const HERO_SELECTORS = [
  '#accueil',
  '#portail-hero',
  '.portal-page-header',
  '.define-tech-filter-bar',
  '.portal-dps-brand-header',
  '.page-header',
  'header.hero',
]

function findHeroAnchor() {
  for (const selector of HERO_SELECTORS) {
    const el = document.querySelector(selector)
    if (el) return el
  }
  return null
}

function isPastElement(el, clearance = NAV_CLEARANCE) {
  if (!el) return false
  return el.getBoundingClientRect().bottom <= clearance
}

function isPastSection(sectionId, clearance = NAV_CLEARANCE) {
  const el = document.getElementById(sectionId)
  if (!el) return false
  return isPastElement(el, clearance)
}

function shouldShowFab({ showAfterSectionId, showAfterPx }) {
  if (showAfterSectionId) return isPastSection(showAfterSectionId)
  if (showAfterPx != null) return window.scrollY > showAfterPx
  const hero = findHeroAnchor()
  if (hero) return isPastElement(hero)
  return window.scrollY > SHOW_AFTER_FALLBACK_PX
}

export default function BackToTopFab({
  showAfterSectionId = null,
  showAfterPx = null,
  className = '',
}) {
  const { t } = useLocale('common')
  const [visible, setVisible] = useState(false)
  const [tone, setTone] = useState('light')

  useEffect(() => {
    let frame = 0

    const update = () => {
      const show = shouldShowFab({ showAfterSectionId, showAfterPx })
      setVisible(show)
      if (show) {
        const fab = document.querySelector('.back-to-top-fab.is-visible')
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

    const root = document.querySelector('main') ?? document.body
    const observer = new MutationObserver(onScroll)
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      observer.disconnect()
    }
  }, [showAfterSectionId, showAfterPx])

  useEffect(() => {
    if (!visible) return undefined
    const id = requestAnimationFrame(() => {
      const fab = document.querySelector('.back-to-top-fab.is-visible')
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
        className,
      ].filter(Boolean).join(' ')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t.backToTopAria}
    >
      <span className="back-to-top-fab-label">{t.backToTop}</span>
      <span className="back-to-top-fab-icon" aria-hidden="true">↑</span>
    </button>
  )
}

/** FAB global — landing, portail, PIF, compétences marque, pages intérieures. */
export function SiteBackToTopFab() {
  const { pathname } = useLocation()
  if (pathname === '/login') return null

  return (
    <BackToTopFab
      className={pathname.startsWith('/portail') ? 'back-to-top-fab--portal' : ''}
    />
  )
}
