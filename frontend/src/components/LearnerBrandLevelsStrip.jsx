import useLocale from '../hooks/useLocale'
import { formatCertLevelLabel, resolveLearnerBrandLevels } from '../utils/portalCertLevel.js'

/** Bandeau hero — marques du technicien et niveau actuel par marque. */
export default function LearnerBrandLevelsStrip({ user, certGoals }) {
  const { t } = useLocale('portal')
  const rows = resolveLearnerBrandLevels(user, certGoals)

  if (!rows.length) return null

  const count = rows.length
  const template = count === 1
    ? (t.hero_brand_title_one || 'Voici vos Niveaux de compétences sur votre marque')
    : (t.hero_brands_title || 'Voici vos Niveaux de compétences sur vos {count} marques')

  const parts = template.includes('{count}')
    ? template.split('{count}')
    : template.includes('{x}')
      ? template.split('{x}')
      : null

  const titleNode = parts && parts.length > 1 ? (
    <>
      {parts[0]}
      <span className="portal-header-brand-levels-stat">{count}</span>
      {parts[1]}
    </>
  ) : template

  return (
    <div className="portal-header-brand-levels" aria-labelledby="portal-header-brand-levels-title">
      <h2 id="portal-header-brand-levels-title" className="portal-header-brand-levels-title">
        {titleNode}
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
