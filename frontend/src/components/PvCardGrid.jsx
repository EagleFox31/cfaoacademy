import { Children } from 'react'

/** Grille accueil type offres marques — 4 colonnes, tronquée à `limit` cartes. */
export default function PvCardGrid({ children, limit, single = false, className = '' }) {
  const items = Children.toArray(children)
  const visible = limit == null ? items : items.slice(0, limit)

  return (
    <div
      className={[
        'pv-card-grid-wrap',
        single ? 'pv-card-grid-wrap--single' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="pv-card-grid">
        {visible.map((child, i) => (
          <div key={child.key ?? i} className="pv-card-grid__cell">
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
