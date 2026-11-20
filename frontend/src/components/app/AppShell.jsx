import { Link } from 'react-router-dom'

/**
 * Gabarit des écrans d'application : barre latérale groupée + barre du haut.
 * Reprend le balisage et les classes `dlv-*` du cockpit delivery
 * (`styles/delivery.css`), sans nouvelle feuille de style.
 *
 * nav = [{ group: libellé, items: [{ id, ico, label, to, count? }] }]
 */
export default function AppShell({
  brand, nav = [], activeId, eyebrow, title, lead, actions, chips, back, children,
}) {
  return (
    <main className="dlv-page">
      <div className="dlv-app">
        <aside className="dlv-aside">
          <div className="dlv-brand">
            <div className="dlv-brand-badge">{brand?.badge}</div>
            <div className="dlv-brand-txt">
              <b>{brand?.title}</b>
              <span>{brand?.subtitle}</span>
            </div>
          </div>
          <nav className="dlv-nav" aria-label={brand?.navLabel}>
            {nav.map(grp => (
              <div key={grp.group}>
                {grp.group && <div className="dlv-nav-group">{grp.group}</div>}
                {grp.items.map(it => {
                  const active = it.id === activeId
                  return (
                    <Link key={it.id} to={it.to}
                      className={`dlv-nav-item ${active ? 'is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}>
                      <span className="dlv-nav-ico" aria-hidden="true">{it.ico}</span>
                      {it.label}
                      {it.count != null && <span className="dlv-nav-count">{it.count}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
          {back && (
            <div className="dlv-aside-foot">
              <Link to={back.to} className="dlv-aside-back">← {back.label}</Link>
            </div>
          )}
        </aside>

        <div className="dlv-main">
          <header className="dlv-topbar">
            <div className="dlv-topbar-l">
              {eyebrow && <div className="dlv-eyebrow">{eyebrow}</div>}
              <h1>{title}</h1>
              {lead && <p className="dlv-lead">{lead}</p>}
            </div>
            <div className="dlv-topbar-r">
              {actions && <div className="dlv-topbar-actions">{actions}</div>}
              {chips && <div className="dlv-topbar-chips">{chips}</div>}
            </div>
          </header>
          <div className="dlv-view">{children}</div>
        </div>
      </div>
    </main>
  )
}
