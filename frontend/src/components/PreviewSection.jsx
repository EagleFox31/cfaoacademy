import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveSectionBackdrop } from '../data/homeSectionBg.js'
import { normalizeSectionVeil } from '../data/sectionBackdropVeils.js'

export default function PreviewSection({
  id, ix, title, voir, tabs, filters,
  bgWord, bgWordSide = 'right',
  sectionBg,
  sectionBgPosition,
  sectionVeil,
  activeTab: controlledActive,
  onTabChange,
  headClass,
  children,
}) {
  const [internalActive, setInternalActive] = useState(tabs?.length ? tabs[0].id : null)
  const active = controlledActive !== undefined ? controlledActive : internalActive
  const setActive = (tabId) => {
    if (onTabChange) onTabChange(tabId)
    else setInternalActive(tabId)
  }

  const autoBackdrop = resolveSectionBackdrop(id)
  const bgImage = sectionBg ?? autoBackdrop?.image ?? null
  const bgPosition = sectionBg
    ? (sectionBgPosition ?? 'center')
    : (sectionBgPosition ?? autoBackdrop?.position ?? 'center')
  const veilKey = normalizeSectionVeil(sectionVeil ?? autoBackdrop?.veil)

  return (
    <section
      id={id}
      className={`tight section-anchor${bgWord ? ' has-deco' : ''}${bgImage ? ' has-section-bg' : ''}`}
      data-section-veil={bgImage ? veilKey : undefined}
    >
      {bgImage && (
        <div
          className="section-bg"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundPosition: bgPosition,
          }}
        />
      )}
      {bgWord && (
        <span
          className={`bg-word ${bgWordSide} parallax`}
          data-speed="-0.38"
          aria-hidden="true"
          style={bgWordSide === 'left' ? { top: '6%' } : { top: '8%' }}
        >
          {bgWord}
        </span>
      )}

      <div className="container">
        <div className={`pv-head${headClass ? ` ${headClass}` : ''}`}>
          <div className="pv-head-l">
            <div className="pv-ix">{ix}</div>
            <h2>{title}</h2>
          </div>
        </div>

        {tabs?.length > 0 && (
          <div className="pv-tabs pv-tabs--pills">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`pv-tab${active === t.id ? ' active' : ''}`}
                onClick={() => setActive(t.id)}
              >
                {t.label}
                {typeof t.count === 'number' && (
                  <span className="tab-count">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {filters?.length > 0 && (
          <div className="pv-filters">
            <span className="lbl">Filtrer</span>
            {filters.map((f, i) => (
              <span className="pv-filter" key={i}>{f}</span>
            ))}
          </div>
        )}

        {typeof children === 'function' ? children(active) : children}

        {voir && (
          <div className="pv-foot">
            {voir.href ? (
              <a
                className={`pv-voir${voir.filled ? ' pv-voir--filled' : ''}`}
                href={voir.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {voir.label} <span className="arrow">↗</span>
              </a>
            ) : voir.to ? (
              <Link className="pv-voir" to={voir.to}>
                {voir.label} <span className="arrow">→</span>
              </Link>
            ) : (
              <button type="button" className="pv-voir" onClick={voir.onClick}>
                {voir.label} <span className="arrow">{voir.expanded ? '↑' : '→'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
