import PvCard from './PvCard.jsx'
import PortalTechnicianCardMedia from './PortalTechnicianCardMedia.jsx'
import { evalScoreAccentColor, evalScoreTier, evalScoreTierClass } from '../utils/learnerTests.js'
import {
  resolveDpsScorePendingClass,
  resolveDpsScorePendingLabel,
} from '../utils/dpsMetrics.js'

const TIER_ROWS = [
  { key: 'junior', labelKey: 'dps_results_tier_maintenance' },
  { key: 'senior', labelKey: 'dps_results_tier_repair' },
  { key: 'expert', labelKey: 'dps_results_tier_diagnostic' },
]

const MODALITY_COLUMNS = [
  { field: 'theory', labelKey: 'dps_results_modality_theory' },
  { field: 'practical', labelKey: 'test_modality_practical' },
  { field: 'manager', labelKey: 'test_modality_manager' },
  { field: 'mastery', isMastery: true },
]

function MatrixScore({ score, pendingLabel, isMastery = false }) {
  if (score == null) {
    return (
      <span className="portal-dps-tech-matrix-cell portal-dps-tech-matrix-cell--empty">
        {pendingLabel}
      </span>
    )
  }

  const tier = evalScoreTier(score)
  return (
    <span
      className={[
        'portal-dps-tech-matrix-cell',
        'portal-dps-tech-matrix-cell--score',
        isMastery && 'portal-dps-tech-matrix-cell--mastery',
        evalScoreTierClass(tier),
      ].filter(Boolean).join(' ')}
    >
      {score}%
    </span>
  )
}

function MatrixMasteryCell({ tier, t }) {
  if (!tier) {
    return <MatrixScore score={null} pendingLabel={t.dps_results_tech_pending} isMastery />
  }
  if (tier.mastery != null) {
    return <MatrixScore score={tier.mastery} isMastery />
  }
  if (tier.pendingReason) {
    const label = resolveDpsScorePendingLabel(tier.pendingReason, t)
    return (
      <span
        className={[
          'portal-dps-tech-matrix-cell',
          'portal-dps-tech-matrix-cell--in-progress',
          resolveDpsScorePendingClass(tier.pendingReason),
        ].join(' ')}
        title={label}
      >
        {label}
      </span>
    )
  }
  if (tier.inProgress) {
    return (
      <span className="portal-dps-tech-matrix-cell portal-dps-tech-matrix-cell--in-progress">
        {t.dps_results_tech_in_progress}
      </span>
    )
  }
  return <MatrixScore score={null} pendingLabel={t.dps_results_tech_pending} isMastery />
}

function TechnicianCompetencyMatrix({ tiers, t }) {
  return (
    <div className="portal-dps-tech-matrix" role="table" aria-label={t.dps_brand_detail_eyebrow}>
      <div className="portal-dps-tech-matrix-row portal-dps-tech-matrix-row--head" role="row">
        <div className="portal-dps-tech-matrix-corner" role="columnheader" aria-hidden="true" />
        {MODALITY_COLUMNS.map(({ field, labelKey, isMastery }) => (
          <div
            key={field}
            role="columnheader"
            className={`portal-dps-tech-matrix-col-head${isMastery ? ' portal-dps-tech-matrix-col-head--mastery' : ''}`}
          >
            {isMastery ? t.dps_results_tech_tier_mastery : t[labelKey]}
          </div>
        ))}
      </div>

      {TIER_ROWS.map(({ key, labelKey }) => (
        <div key={key} className="portal-dps-tech-matrix-row portal-dps-tech-matrix-row--tier" role="row">
          <div
            role="rowheader"
            className="portal-dps-tech-matrix-row-label portal-dps-tech-matrix-row-label--tier"
          >
            {t[labelKey]}
          </div>
          {MODALITY_COLUMNS.map(({ field, isMastery }) => (
            <div
              key={field}
              className={`portal-dps-tech-matrix-cell-wrap${isMastery ? ' portal-dps-tech-matrix-cell-wrap--mastery' : ''}`}
              role="cell"
            >
              {isMastery ? (
                <MatrixMasteryCell tier={tiers?.[key]} t={t} />
              ) : (
                <MatrixScore
                  score={tiers?.[key]?.[field] ?? null}
                  pendingLabel={t.dps_results_tech_pending}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function DpsTechnicianResultCard({ technician, brandId, t }) {
  return (
    <PvCard
      className="portal-plan-entry-card portal-dps-tech-result-card"
      cardMedia={(
        <PortalTechnicianCardMedia
          person={technician}
          brand={brandId}
          mediaClassName="portal-dps-tech-result-card-media"
        />
      )}
      title={technician.name}
      meta={(
        <div className="portal-dps-tech-result-meta">
          {technician.agency ? (
            <p className="portal-dps-tech-result-agency">{technician.agency}</p>
          ) : null}
          <TechnicianCompetencyMatrix tiers={technician.tiers} t={t} />
        </div>
      )}
      accentColor={evalScoreAccentColor(technician.mastery)}
      corner={false}
    />
  )
}
