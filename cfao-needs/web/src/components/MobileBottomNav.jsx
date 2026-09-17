import { NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '../i18n'
import { isReviewer } from '../lib/auth'

function IconCar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function IconOutbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

/**
 * Bottom Navigation Bar pour smartphone (Option A).
 * Permet un accès instantané sous le pouce aux 3 zones clés :
 * - Marques
 * - Synthèse T1-T4 & lieux
 * - Transmettre / Mettre à jour
 */
export default function MobileBottomNav({ session, pendingCount = 0 }) {
  const { t } = useLocale()
  const reviewer = isReviewer(session)
  const location = useLocation()
  const isBrandEntry = location.pathname.startsWith('/marque/')

  // Sur la saisie par marque, la barre [ Enregistrer ] prend la place
  if (isBrandEntry) return null

  const scrollTo = (id) => {
    if (location.pathname !== '/') {
      window.location.href = `/#${id}`
      return
    }
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      {reviewer ? (
        <>
          <NavLink to="/" end className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon"><IconCar /></span>
            <span className="mobile-bottom-nav__label">{t('nav.brands')}</span>
          </NavLink>
          <NavLink to="/relecture" className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon">
              <IconInbox />
              {pendingCount > 0 && <span className="mobile-bottom-nav__badge">{pendingCount}</span>}
            </span>
            <span className="mobile-bottom-nav__label">{t('nav.inbox')}</span>
          </NavLink>
          <NavLink to="/a-envoyer" className="mobile-bottom-nav__item">
            <span className="mobile-bottom-nav__icon"><IconOutbox /></span>
            <span className="mobile-bottom-nav__label">{t('nav.outbox')}</span>
          </NavLink>
        </>
      ) : (
        <>
          <button
            type="button"
            className="mobile-bottom-nav__item"
            onClick={() => scrollTo('marques-section')}
          >
            <span className="mobile-bottom-nav__icon"><IconCar /></span>
            <span className="mobile-bottom-nav__label">{t('nav.brands')}</span>
          </button>
          <button
            type="button"
            className="mobile-bottom-nav__hero-btn"
            onClick={() => scrollTo('submit-panel-action')}
            aria-label={t('nav.submit')}
          >
            <span className="mobile-bottom-nav__hero-icon"><IconSend /></span>
            <span className="mobile-bottom-nav__hero-label">{t('nav.submit')}</span>
          </button>
          <button
            type="button"
            className="mobile-bottom-nav__item"
            onClick={() => scrollTo('synthese-section')}
          >
            <span className="mobile-bottom-nav__icon"><IconBarChart /></span>
            <span className="mobile-bottom-nav__label">{t('nav.summary')}</span>
          </button>
        </>
      )}
    </nav>
  )
}
