import { NavLink } from 'react-router-dom'

import { useCampaign } from '../App'
import { useLocale } from '../i18n'
import { isReviewer } from '../lib/auth'
import LocaleSwitch from './LocaleSwitch'
import { useSaveStatus } from './SaveStatus'
import { SaveIndicator } from './ui'
import UserMenu from './UserMenu'

/**
 * Coquille de l'application : un bandeau horizontal, puis le contenu centré.
 *
 * Pas de barre latérale : le parcours filiale tient en deux écrans, une colonne
 * de navigation permanente pour une seule destination coûte de la largeur sans
 * rien apporter. Les relecteurs Academy ont plusieurs destinations, elles
 * s'ajoutent en pastilles dans le bandeau plutôt qu'en colonne.
 */

function IconNeeds() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M16 4h2a2 2 0 0 1 2 2v5" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
      <path d="M21.4 13.6a2 2 0 0 0-2.8 0L15 17.2V20h2.8l3.6-3.6a2 2 0 0 0 0-2.8z" />
    </svg>
  )
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function IconOutbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

export default function AppShell({ session, pendingCount = 0, children }) {
  const { t, locale, setLocale, available } = useLocale()
  const reviewer = isReviewer(session)
  // L'année vient de la campagne ouverte : écrite en dur, elle survivrait à la
  // campagne qu'elle annonce.
  const year = useCampaign()?.campaign?.year
  // Le témoin de sauvegarde vit ici et non dans la grille : celle-ci défile, le
  // bandeau non.
  const saveState = useSaveStatus()

  return (
    <div className="shell">
      <header className="topbar">
        {/* Trois colonnes pleine largeur, comme la vitrine : le logo touche le
            bord gauche et les actions le bord droit, la navigation reste centrée. */}
        <div className="topbar__inner">
          {/* Même signature que la vitrine : le logo groupe, une filet, puis
              « Academy » et son point rouge. */}
          <div className="topbar__brand">
            <img src="/assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="topbar__logo" />
            <span className="topbar__wordmark">
              Academy<span>.</span>
            </span>
          </div>

          <nav className="topnav" aria-label={t('app.name')}>
            <NavLink to="/" end className="topnav__pill">
              <span className="topnav__icon"><IconNeeds /></span>
              <span className="topnav__label">
                {t('nav.needs')}
                {year ? ` ${year}` : ''}
              </span>
            </NavLink>

            {reviewer && (
              <>
                <NavLink to="/relecture" className="topnav__pill">
                  <span className="topnav__icon"><IconInbox /></span>
                  <span className="topnav__label">{t('nav.inbox')}</span>
                </NavLink>
                <NavLink to="/a-envoyer" className="topnav__pill">
                  <span className="topnav__icon"><IconOutbox /></span>
                  <span className="topnav__label">{t('nav.outbox')}</span>
                  {pendingCount > 0 && <span className="topnav__count">{pendingCount}</span>}
                </NavLink>
              </>
            )}
          </nav>

          <div className="topbar__right">
            <SaveIndicator state={saveState} />
            <LocaleSwitch
              locale={locale}
              onChange={setLocale}
              available={available}
              ariaLabel={t('app.locale')}
            />
            <UserMenu session={session} />
          </div>
        </div>
      </header>

      <main className="shell__main">
        <div className="shell__container">{children}</div>
      </main>
    </div>
  )
}
