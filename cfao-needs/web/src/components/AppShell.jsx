import { NavLink } from 'react-router-dom'

import { useLocale } from '../i18n'
import { isReviewer, logout } from '../lib/auth'

/**
 * Coquille applicative : sidebar + topbar denses.
 *
 * C'est un **cockpit**, pas une vitrine — aucun composant de la vitrine (hero,
 * glass panel, PvCard) n'a sa place ici.
 */
export default function AppShell({ session, pendingCount = 0, children }) {
  const { t, locale, setLocale, available } = useLocale()
  const reviewer = isReviewer(session)
  const name = session?.claims?.name || session?.claims?.preferred_username || ''

  return (
    <div className="shell">
      <div className="shell__brand">
        <div>
          {t('app.name')}
          <small>{t('app.subtitle')}</small>
        </div>
      </div>

      <header className="shell__topbar">
        <div className="row">
          <span className="muted">{name}</span>
        </div>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t('app.locale')}
            </span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="place"
              aria-label={t('app.locale')}
            >
              {available.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--ghost" onClick={logout}>
            {t('app.logout')}
          </button>
        </div>
      </header>

      <nav className="shell__nav" aria-label={t('app.name')}>
        <div className="nav-group">
          <div className="nav-group__label">{t('nav.myEntry')}</div>
          <NavLink to="/" end className="nav-item">
            {t('nav.campaign')}
          </NavLink>
          <NavLink to="/saisie" className="nav-item">
            {t('nav.grid')}
          </NavLink>
          <NavLink to="/recapitulatif" className="nav-item">
            {t('nav.recap')}
          </NavLink>
          <NavLink to="/suivi" className="nav-item">
            {t('nav.tracking')}
          </NavLink>
        </div>

        {reviewer && (
          <div className="nav-group">
            <div className="nav-group__label">{t('nav.team')}</div>
            <NavLink to="/relecture" className="nav-item">
              {t('nav.inbox')}
            </NavLink>
            <NavLink to="/a-envoyer" className="nav-item">
              <span>{t('nav.outbox')}</span>
              {pendingCount > 0 && <span className="nav-item__count">{pendingCount}</span>}
            </NavLink>
          </div>
        )}
      </nav>

      <main className="shell__main">{children}</main>
    </div>
  )
}
