import PortalBrandLogo from '../../../components/PortalBrandLogo.jsx'
import { evalScoreTier, evalScoreTierClass } from '../../../utils/learnerTests.js'

function BrandScore({ score, pendingLabel }) {
  if (score == null) {
    return (
      <span className="portal-dps-pif-brand-card-score portal-dps-pif-brand-card-score--pending">
        {pendingLabel}
      </span>
    )
  }

  const tier = evalScoreTier(score)
  return (
    <span className={`portal-dps-pif-brand-card-score${evalScoreTierClass(tier)}`}>
      {score}
      %
    </span>
  )
}

export default function DefineTechnicianBrandPanel({ brandRows, t }) {
  if (!brandRows.length) {
    return (
      <p className="portal-morph-empty portal-dps-brand-empty">
        {t.medacap_define_no_brands}
      </p>
    )
  }

  return (
    <section className="portal-dps-pif-brand-section" aria-labelledby="portal-dps-pif-brand-title">
      <h2 id="portal-dps-pif-brand-title" className="portal-dps-tier-section-title">
        {t.medacap_define_chart_title}
      </h2>

      <ul className="portal-dps-pif-brand-grid">
        {brandRows.map(row => (
          <li key={row.brandId} className="portal-dps-pif-brand-card">
            <div className="portal-dps-pif-brand-card-logo">
              {row.logo ? (
                <PortalBrandLogo brand={row.brandId} size="media" />
              ) : (
                <span className="portal-dps-pif-brand-card-wordmark">{row.label}</span>
              )}
            </div>

            <p className="portal-dps-pif-brand-card-name">{row.label}</p>

            <p className="portal-dps-pif-brand-card-plan">
              <span className="portal-dps-pif-brand-card-plan-value">{row.formationCount}</span>
              {' '}
              {t.dps_pif_tech_formations_label}
            </p>

            <div className="portal-dps-pif-brand-card-measure">
              <span className="portal-dps-pif-brand-card-measure-lbl">
                {t.medacap_define_brand_score_label}
              </span>
              <BrandScore score={row.avgScore} pendingLabel={t.dps_results_tech_pending} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
