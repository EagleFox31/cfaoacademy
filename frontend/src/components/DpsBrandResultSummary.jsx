import DpsResultTierRow from './DpsResultTierRow.jsx'
import {
  formatDpsBrandEvaluatedLine,
  formatDpsTierSectionTitle,
  resolveBrandResultTierRows,
} from '../utils/dpsBrandResultSummary.js'

/**
 * Panneau scores marque DPS — cartes #resultats et fiche détail.
 * @param {{ avgScore?: number|null, evaluated?: number, tiers?: Record<string, { count?: number, avgScore?: number|null }> }} summary
 * @param {'card'|'detail'} variant
 * @param {'medacap'|'toyota'} nomenclature — toyota = libellés G4/G3/G2 (KI)
 */
export default function DpsBrandResultSummary({
  summary,
  t,
  variant = 'card',
  nomenclature = 'medacap',
  className = '',
  globalLabelText = null,
}) {
  const totalCount = summary?.evaluated ?? 0
  const totalTechnicians = summary?.technicians ?? null
  const displayTechCount = (totalTechnicians != null && totalTechnicians > 0) ? totalTechnicians : totalCount
  const pendingLabel = t.dps_results_brand_no_score
  const tierRowsConfig = resolveBrandResultTierRows(nomenclature)

  const tierRows = tierRowsConfig
    .map(({ key, labelKey }) => {
      const tier = summary?.tiers?.[key]
      if (!tier?.count && tier?.avgScore == null) return null

      const count = tier?.count ?? 0
      const label = variant === 'detail'
        ? formatDpsTierSectionTitle(count, t[labelKey], t)
        : (t[labelKey] || key)

      return (
        <DpsResultTierRow
          key={key}
          label={label}
          score={tier.avgScore ?? null}
          pendingLabel={pendingLabel}
          scoreTitle={t.dps_results_brand_avg_tooltip_tier}
        />
      )
    })
    .filter(Boolean)

  const globalCountText = totalTechnicians != null && totalTechnicians > 0
    ? `${totalCount}/${totalTechnicians}`
    : String(totalCount)

  const globalLabel = variant === 'detail' ? (
    <>
      <span className="portal-dps-brand-result-tier-count">{globalCountText}</span>
      {' '}
      {globalLabelText ?? t.dps_brand_detail_global_label}
    </>
  ) : (globalLabelText ?? t.dps_results_brand_global_label)

  const rootClass = [
    'portal-dps-brand-result-meta',
    variant === 'detail' ? 'portal-dps-brand-detail-summary' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {variant === 'detail' ? (
        <p className="portal-morph-brand-kicker portal-brand-detail-summary-kicker">
          {t.dps_brand_detail_eyebrow}
        </p>
      ) : null}
      {variant === 'card' && displayTechCount > 0 ? (
        <div className="portal-dps-brand-tech-badge-container">
          <div className="portal-dps-brand-tech-badge">
            <span className="portal-dps-brand-tech-badge-count">{displayTechCount}</span>
            <span className="portal-dps-brand-tech-badge-label">
              {displayTechCount > 1 ? (t.dps_technicians_label || 'Techniciens') : (t.dps_technician_label || 'Technicien')}
            </span>
          </div>
        </div>
      ) : null}
      <div className="portal-dps-brand-result-tiers">
        {tierRows}
        <DpsResultTierRow
          label={globalLabel}
          score={summary?.avgScore ?? null}
          pendingLabel={pendingLabel}
          scoreTitle={t.dps_results_brand_avg_tooltip_global}
          isGlobal
        />
      </div>
    </div>
  )
}
