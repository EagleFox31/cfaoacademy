import { useMemo } from 'react'
import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'

function brandRow(brandStat) {
  const def = TEAM_BRAND_DEFS[brandStat.brand]
  return {
    brand: brandStat.brand,
    label: def?.label ?? brandStat.brand,
    logo: def?.logo ?? null,
  }
}

/** Bandeau hero DPS — logos des marques de la filiale. */
export default function DpsFilialeBrandsStrip({ brandStats }) {
  const rows = useMemo(
    () => (brandStats ?? []).map(brandRow),
    [brandStats],
  )

  if (!rows.length) return null

  return (
    <div className="portal-header-brand-levels portal-header-brand-levels--dps">
      <ul
        className="portal-header-brand-levels-grid"
        style={{ '--brand-columns': rows.length }}
      >
        {rows.map((row) => (
          <li
            key={row.brand}
            className={`portal-header-brand-level-card portal-header-brand-level-card--${row.brand}`}
          >
            <span className="portal-header-brand-level-card-logo">
              {row.logo ? (
                <img
                  src={row.logo}
                  alt={row.label}
                  className="portal-header-brand-level-card-img"
                />
              ) : (
                <span className="portal-header-brand-level-card-fallback">{row.label}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
