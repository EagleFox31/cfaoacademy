import { Link } from 'react-router-dom'
import LocaleSwitch from '../LocaleSwitch'
import PortalDemoBar from '../PortalDemoBar'
import useLocale from '../../hooks/useLocale'

/** Barre de progression des cockpits (`tone` : '', 'navy', 'red'). */
export function CockpitBar({ pct, tone = '' }) {
  return <div className={`dlv-bar ${tone}`}><i style={{ width: `${pct}%` }} /></div>
}

/**
 * Cadre commun des cockpits du portail (pilotage projet, RH...).
 *
 * Barre laterale groupee par theme, barre du haut (surtitre, titre, accroche,
 * langue, retour au site, puces), bandeau optionnel, puis la vue courante.
 * Chaque cockpit ne fournit que son contenu : la presentation reste la meme
 * d'un profil a l'autre.
 *
 * @param {{ badge: string, title: string, subtitle: string }} brand
 * @param {{ group: string, items: { id: string, ico: string, label: string, count?: number }[] }[]} nav
 */
export default function CockpitShell({
  brand, nav, view, onView,
  eyebrow, title, lead, chips, banner,
  backPortalLabel, backSiteLabel,
  children,
}) {
  const { t: commonT, locale, setLocale } = useLocale('common')
  return (
    <>
      <main className="dlv-page">
        <div className="dlv-app">
          <aside className="dlv-aside">
            <div className="dlv-brand">
              <div className="dlv-brand-badge">{brand.badge}</div>
              <div className="dlv-brand-txt">
                <b>{brand.title}</b>
                <span>{brand.subtitle}</span>
              </div>
            </div>
            <nav className="dlv-nav">
              {nav.map(grp => (
                <div key={grp.group}>
                  <div className="dlv-nav-group">{grp.group}</div>
                  {grp.items.map(it => (
                    <button key={it.id} type="button"
                      className={`dlv-nav-item ${view === it.id ? 'is-active' : ''}`}
                      onClick={() => onView(it.id)}>
                      <span className="dlv-nav-ico">{it.ico}</span>
                      {it.label}
                      {it.count != null && <span className="dlv-nav-count">{it.count}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="dlv-aside-foot">
              <Link to="/portail" className="dlv-aside-back">← {backPortalLabel}</Link>
            </div>
          </aside>

          <div className="dlv-main">
            <header className="dlv-topbar">
              <div className="dlv-topbar-l">
                <div className="dlv-eyebrow">{eyebrow}</div>
                <h1>{title}</h1>
                <p className="dlv-lead">{lead}</p>
              </div>
              <div className="dlv-topbar-r">
                <div className="dlv-topbar-actions">
                  <LocaleSwitch
                    locale={locale}
                    onChange={setLocale}
                    ariaLabel={commonT.langSwitchAria}
                    className="locale-switch--dlv"
                  />
                  <Link to="/" className="dlv-topbar-back">{backSiteLabel} →</Link>
                </div>
                {chips && <div className="dlv-topbar-chips">{chips}</div>}
              </div>
            </header>

            {banner}

            <div className="dlv-view">{children}</div>
          </div>
        </div>
      </main>
      <PortalDemoBar />
    </>
  )
}
