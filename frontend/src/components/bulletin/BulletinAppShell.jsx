import { Link } from 'react-router-dom'
import LocaleSwitch from '../LocaleSwitch.jsx'

export default function BulletinAppShell({
  t,
  user,
  title,
  lead,
  children,
  actions,
}) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  return (
    <div className="bltn-page">
      <header className="bltn-header">
        <div className="bltn-header-inner">
          <div className="bltn-header-nav">
            <Link to="/portail#resultats" className="bltn-back">
              ← {t.bulletin_back_portal}
            </Link>
            <span className="bltn-header-sep" aria-hidden="true" />
            <Link to="/portail#tests" className="bltn-header-link">
              {t.nav_sec_tests}
            </Link>
          </div>
          <div className="bltn-header-actions">
            {actions}
            <LocaleSwitch />
          </div>
        </div>
        <div className="bltn-header-main container">
          <p className="bltn-eyebrow">{t.bulletin_eyebrow}</p>
          <h1 className="bltn-title">{title ?? t.bulletin_title}</h1>
          {lead ? <p className="bltn-lead">{lead}</p> : null}
          {name ? (
            <p className="bltn-user-meta">
              {name}
              {user?.orgLabel ? ` · ${user.orgLabel}` : ''}
            </p>
          ) : null}
        </div>
      </header>
      <div className="bltn-body container">
        {children}
      </div>
    </div>
  )
}
