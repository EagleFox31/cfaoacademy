import { evalScoreTier, evalScoreTierClass } from '../utils/learnerTests.js'
import {
  DPS_SCORE_PENDING_REASON,
  resolveDpsScorePendingClass,
  resolveDpsScorePendingLabel,
} from '../utils/dpsMetrics.js'
import {
  dpsTechnicianRoleTableWrapClass,
  resolveDpsTechnicianRoleLabel,
} from '../utils/dpsTechnicianRoleTheme.js'

function resolvePracticalPendingReason(row) {
  if (row.practical != null) return null
  if (row.declarativeStage === 'awaiting_manager') {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_MANAGER
  }
  if (row.declarativeStage === 'technician_in_progress') {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN_IN_PROGRESS
  }
  if (row.declarativeStage === 'awaiting_technician') {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN
  }
  if (
    row.pendingReason === DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN ||
    row.pendingReason === DPS_SCORE_PENDING_REASON.DECLARATIVE_MANAGER
  ) {
    return row.pendingReason
  }
  return null
}

function ScoreCell({
  score,
  pendingLabel,
  pendingReason,
  inProgressLabel,
  scoreTitle,
  t,
  isTotal = false,
}) {
  if (score != null) {
    const tier = evalScoreTier(score)
    return (
      <span
        className={[
          'portal-dps-tier-table-score',
          isTotal && 'portal-dps-tier-table-score--total',
          evalScoreTierClass(tier),
          scoreTitle && 'portal-dps-tier-table-score--hint',
        ].filter(Boolean).join(' ')}
        title={scoreTitle || undefined}
      >
        {score}%
      </span>
    )
  }

  if (pendingReason) {
    const label = resolveDpsScorePendingLabel(pendingReason, t)
    return (
      <span
        className={[
          'portal-dps-tier-table-score',
          'portal-dps-tier-table-score--in-progress',
          resolveDpsScorePendingClass(pendingReason),
        ].join(' ')}
        title={label}
      >
        {label}
      </span>
    )
  }

  if (inProgressLabel) {
    return (
      <span className="portal-dps-tier-table-score portal-dps-tier-table-score--in-progress">
        {inProgressLabel}
      </span>
    )
  }

  return (
    <span className="portal-dps-tier-table-score portal-dps-tier-table-score--empty">
      {pendingLabel}
    </span>
  )
}

function RoleLabel({ roleTier, t }) {
  const label = resolveDpsTechnicianRoleLabel(roleTier, t)
  if (!label) return null
  return <span className="portal-dps-tier-table-role-label">{label}</span>
}

export default function DpsBrandTierTechniciansTable({
  rows,
  tierKey,
  tierAvgScore,
  tierAvgTheoryScore,
  tierAvgPracticalScore,
  t,
}) {
  return (
    <div
      className={[
        'portal-table-wrap',
        'portal-dps-tier-table-wrap',
        dpsTechnicianRoleTableWrapClass(tierKey),
      ].join(' ')}
    >
      <table className="portal-table portal-dps-tier-table">
        <colgroup>
          <col className="portal-dps-tier-table-col-last" />
          <col className="portal-dps-tier-table-col-first" />
          <col className="portal-dps-tier-table-col-role" />
          <col className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--theory" />
          <col className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--practical" />
          <col className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--total" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t.dps_table_col_last_name}</th>
            <th scope="col">{t.dps_table_col_first_name}</th>
            <th scope="col" className="portal-dps-tier-table-col-role">
              {t.dps_table_col_role}
            </th>
            <th
              scope="col"
              className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--theory"
              title={t.dps_table_col_theory_hint}
            >
              {t.dps_table_col_theory}
            </th>
            <th
              scope="col"
              className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--practical"
              title={t.dps_table_col_practical_hint}
            >
              {t.dps_table_col_practical}
            </th>
            <th
              scope="col"
              className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--total"
              title={t.dps_table_col_score_total_hint}
            >
              {t.dps_table_col_score_total}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className={row.inProgress ? 'portal-dps-tier-table-row--in-progress' : undefined}
            >
              <td>{row.lastName}</td>
              <td>{row.firstName}</td>
              <td className="portal-dps-tier-table-col-role">
                <RoleLabel roleTier={row.roleTier} t={t} />
              </td>
              <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--theory">
                <ScoreCell
                  score={row.theory}
                  pendingLabel={t.dps_results_tech_pending}
                  inProgressLabel={row.theoryInProgress ? t.dps_results_pending_factuel_in_progress : undefined}
                  t={t}
                />
              </td>
              <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--practical">
                <ScoreCell
                  score={row.practical}
                  pendingLabel={t.dps_results_tech_pending}
                  pendingReason={resolvePracticalPendingReason(row)}
                  inProgressLabel={row.practicalInProgress ? t.dps_results_tech_in_progress : undefined}
                  t={t}
                />
              </td>
              <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--total">
                <ScoreCell
                  score={row.scoreTotal}
                  pendingLabel={t.dps_results_tech_pending}
                  pendingReason={row.pendingReason}
                  inProgressLabel={t.dps_results_tech_in_progress}
                  t={t}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="portal-dps-tier-table-total-row">
            <td colSpan={3}>{t.dps_table_row_total}</td>
            <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--theory">
              <ScoreCell
                score={tierAvgTheoryScore}
                pendingLabel={t.dps_results_tech_pending}
                isTotal
                t={t}
              />
            </td>
            <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--practical">
              <ScoreCell
                score={tierAvgPracticalScore}
                pendingLabel={t.dps_results_tech_pending}
                isTotal
                t={t}
              />
            </td>
            <td className="portal-dps-tier-table-col-score portal-dps-tier-table-col-score--total">
              <ScoreCell
                score={tierAvgScore}
                pendingLabel={t.dps_results_brand_no_score}
                scoreTitle={t.dps_results_brand_avg_tooltip_tier}
                isTotal
                t={t}
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
