import useLocale from '../hooks/useLocale'
import { formatCertLevelLabel, resolveLearnerBrandLevels } from '../utils/portalCertLevel.js'

/** Bandeau hero — marques du technicien et niveau actuel par marque. */
export default function LearnerBrandLevelsStrip({ user, certGoals }) {
  const { t } = useLocale('portal')
  const rows = resolveLearnerBrandLevels(user, certGoals)

  if (!rows.length) return null

  return (
    <div className="portal-header-brand-levels" aria-labelledby="portal-header-brand-levels-title">
      <h2 id="portal-header-brand-levels-title" className="portal-header-brand-levels-title">
        {t.hero_brands_title_l1 && t.hero_brands_title_l2 ? (
          <>
            <span className="portal-header-brand-levels-title-line">{t.hero_brands_title_l1}</span>
            <span className="portal-header-brand-levels-title-line">{t.hero_brands_title_l2}</span>
          </>
        ) : (
          t.hero_brands_title
        )}
      </h2>
      <ul className="portal-header-brand-levels-grid">
        {rows.map(row => (
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
            <span className="portal-header-brand-level-card-level">
              {formatCertLevelLabel(row.currentLevel, t)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
