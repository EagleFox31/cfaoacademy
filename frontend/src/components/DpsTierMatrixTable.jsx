import { useMemo } from 'react'
import { evalScoreTier, evalScoreTierClass } from '../utils/learnerTests.js'
import { dpsTechnicianRoleTableWrapClass } from '../utils/dpsTechnicianRoleTheme.js'

function TheoryIcon({ className = '' }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function PracticalIcon({ className = '' }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

function MatrixScoreCell({ cellData, brandLabel, t }) {
  if (!cellData) {
    return <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--empty">—</span>
  }

  const { score, theory, practical, status, labelKey, label } = cellData

  if (score != null) {
    const tier = evalScoreTier(score)
    return (
      <div className="portal-dps-matrix-score-wrap">
        <span
          className={[
            'portal-dps-matrix-score',
            evalScoreTierClass(tier),
          ].join(' ')}
        >
          {score}%
        </span>
        <div className="portal-dps-matrix-popover" role="tooltip">
          {brandLabel && (
            <div className="portal-dps-popover-header">
              <span className="portal-dps-popover-brand">{brandLabel}</span>
            </div>
          )}
          <div className="portal-dps-popover-body">
            <div className="portal-dps-popover-row">
              <span className="portal-dps-popover-key">
                <TheoryIcon />
                <span>Théorie</span>
              </span>
              <span className="portal-dps-popover-val">{theory != null ? `${theory}%` : '—'}</span>
            </div>
            <div className="portal-dps-popover-row">
              <span className="portal-dps-popover-key">
                <PracticalIcon />
                <span>Pratique</span>
              </span>
              <span className="portal-dps-popover-val">{practical != null ? `${practical}%` : '—'}</span>
            </div>
          </div>
          <div className="portal-dps-popover-foot">
            <span className="portal-dps-popover-foot-lbl">{t.dps_tier_matrix_final_score || 'Note finale'}</span>
            <span className="portal-dps-popover-foot-res">{score}%</span>
          </div>
        </div>
      </div>
    )
  }

  const displayLabel = labelKey ? (t[labelKey] || label || labelKey) : (label || '—')

  if (status === 'pending_practical' || status === 'pending_theory' || status === 'pending_manager' || status === 'in_progress') {
    return (
      <div className="portal-dps-matrix-score-wrap">
        <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--pending">
          {displayLabel}
        </span>
        <div className="portal-dps-matrix-popover" role="tooltip">
          {brandLabel && (
            <div className="portal-dps-popover-header">
              <span className="portal-dps-popover-brand">{brandLabel}</span>
              <span className="portal-dps-popover-tag portal-dps-popover-tag--pending">En cours</span>
            </div>
          )}
          <div className="portal-dps-popover-body">
            {theory != null && (
              <div className="portal-dps-popover-row">
                <span className="portal-dps-popover-key">
                  <TheoryIcon />
                  <span>Théorie</span>
                </span>
                <span className="portal-dps-popover-val">{theory}%</span>
              </div>
            )}
            {practical != null && (
              <div className="portal-dps-popover-row">
                <span className="portal-dps-popover-key">
                  <PracticalIcon />
                  <span>Pratique</span>
                </span>
                <span className="portal-dps-popover-val">{practical}%</span>
              </div>
            )}
            <div className="portal-dps-popover-hint">
              {status === 'pending_practical'
                ? 'Épreuve pratique en atelier à planifier'
                : status === 'pending_theory'
                  ? 'Évaluation théorique QCM à passer'
                  : status === 'pending_manager'
                    ? 'En attente de validation manager'
                    : 'Évaluation en cours'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'not_evaluated') {
    return (
      <div className="portal-dps-matrix-score-wrap">
        <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--not-eval">
          {displayLabel}
        </span>
        <div className="portal-dps-matrix-popover" role="tooltip">
          {brandLabel && (
            <div className="portal-dps-popover-header">
              <span className="portal-dps-popover-brand">{brandLabel}</span>
            </div>
          )}
          <div className="portal-dps-popover-hint">
            Rattaché à la marque, aucun test passé
          </div>
        </div>
      </div>
    )
  }

  return (
    <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--empty" title="Non rattaché à cette marque">
      {displayLabel}
    </span>
  )
}

export default function DpsTierMatrixTable({
  technicians,
  brands,
  tierKey,
  t,
}) {
  const metierLabel = useMemo(() => {
    if (tierKey === 'expert') return t.dps_results_tier_diagnostic || 'Diagnostic'
    if (tierKey === 'senior') return t.dps_results_tier_repair || 'Réparation'
    return t.dps_results_tier_maintenance || 'Maintenance'
  }, [tierKey, t])

  const brandAverages = useMemo(() => {
    return brands.map(b => {
      const scores = technicians
        .map(tech => tech.brandScores?.[b.id]?.score)
        .filter(s => s != null)
      if (!scores.length) return { brandId: b.id, avg: null, count: 0 }
      const avg = Math.round(scores.reduce((acc, v) => acc + v, 0) / scores.length)
      return { brandId: b.id, avg, count: scores.length }
    })
  }, [brands, technicians])

  const grandAverage = useMemo(() => {
    const all = technicians
      .flatMap(tech => brands.map(b => tech.brandScores?.[b.id]?.score))
      .filter(s => s != null)
    if (!all.length) return null
    return Math.round(all.reduce((acc, v) => acc + v, 0) / all.length)
  }, [brands, technicians])

  return (
    <div
      className={[
        'portal-dps-matrix-table-wrap',
        dpsTechnicianRoleTableWrapClass(tierKey),
      ].join(' ')}
    >
      <table className="portal-table portal-dps-matrix-table">
        <thead>
          <tr>
            <th scope="col" className="portal-dps-matrix-col-last">{t.dps_table_col_last_name}</th>
            <th scope="col" className="portal-dps-matrix-col-first">{t.dps_table_col_first_name}</th>
            <th scope="col" className="portal-dps-matrix-col-role">{t.dps_tier_matrix_col_metier || 'Métier'}</th>
            <th scope="col" className="portal-dps-matrix-col-agency">{t.dps_tier_matrix_col_agency}</th>
            {brands.map(brand => (
              <th
                key={brand.id}
                scope="col"
                className="portal-dps-matrix-col-brand"
                title={`Marque : ${brand.label}`}
              >
                {brand.logo ? (
                  <div className="portal-dps-matrix-brand-head">
                    <img
                      src={brand.logo}
                      alt={brand.label}
                      title={brand.label}
                      className="portal-dps-matrix-brand-logo"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <span className="portal-dps-matrix-brand-name">{brand.label}</span>
                )}
              </th>
            ))}
            <th
              scope="col"
              className="portal-dps-matrix-col-total"
              title="Moyenne générale de maîtrise du technicien sur ses marques évaluées"
            >
              {t.dps_tier_matrix_col_total || 'Total'}
            </th>
          </tr>
        </thead>
        <tbody>
          {technicians.map(tech => {
            const evaluatedScores = brands
              .map(b => tech.brandScores?.[b.id]?.score)
              .filter(s => s != null)
            const techAvg = evaluatedScores.length > 0
              ? Math.round(evaluatedScores.reduce((acc, v) => acc + v, 0) / evaluatedScores.length)
              : null

            return (
              <tr key={tech.id}>
                <td className="portal-dps-matrix-col-last">
                  <strong className="portal-dps-matrix-name-bold">{tech.lastName}</strong>
                </td>
                <td className="portal-dps-matrix-col-first">
                  <span className="portal-dps-matrix-name-first">{tech.firstName}</span>
                </td>
                <td className="portal-dps-matrix-col-role">
                  <span className="portal-dps-matrix-role-badge">{metierLabel}</span>
                </td>
                <td className="portal-dps-matrix-col-agency">
                  {tech.agency}
                </td>
                {brands.map(brand => (
                  <td key={brand.id} className="portal-dps-matrix-col-brand">
                    <MatrixScoreCell
                      cellData={tech.brandScores?.[brand.id]}
                      brandLabel={brand.label}
                      t={t}
                    />
                  </td>
                ))}
                <td className="portal-dps-matrix-col-total">
                  {techAvg != null ? (
                    <div className="portal-dps-matrix-score-wrap">
                      <span className={`portal-dps-matrix-score portal-dps-matrix-score--tech-total ${evalScoreTierClass(evalScoreTier(techAvg))}`}>
                        {techAvg}%
                      </span>
                      <div className="portal-dps-matrix-popover" role="tooltip">
                        <div className="portal-dps-popover-header">
                          <span className="portal-dps-popover-brand">Moyenne technicien</span>
                        </div>
                        <div className="portal-dps-popover-hint">
                          Moyenne sur {evaluatedScores.length} marque{evaluatedScores.length > 1 ? 's' : ''} évaluée{evaluatedScores.length > 1 ? 's' : ''} : <strong>{techAvg}%</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--empty">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="portal-dps-matrix-foot-row">
            <td colSpan={2} className="portal-dps-matrix-col-last portal-dps-matrix-foot-label">
              <strong>{t.dps_tier_matrix_row_avg || 'Maîtrise moyenne par marque'}</strong>
            </td>
            <td className="portal-dps-matrix-col-role portal-dps-matrix-foot-spacer">—</td>
            <td className="portal-dps-matrix-col-agency portal-dps-matrix-foot-spacer">—</td>
            {brandAverages.map(({ brandId, avg, count }) => {
              const brandDef = brands.find(b => b.id === brandId)
              return (
                <td key={brandId} className="portal-dps-matrix-col-brand portal-dps-matrix-foot-score">
                  {avg != null ? (
                    <div className="portal-dps-matrix-score-wrap">
                      <span className={`portal-dps-matrix-score portal-dps-matrix-score--foot ${evalScoreTierClass(evalScoreTier(avg))}`}>
                        {avg}%
                      </span>
                      <div className="portal-dps-matrix-popover" role="tooltip">
                        <div className="portal-dps-popover-header">
                          <span className="portal-dps-popover-brand">{brandDef?.label || brandId}</span>
                        </div>
                        <div className="portal-dps-popover-hint">
                          Moyenne atelier sur cette marque : <strong>{avg}%</strong>
                          <br />
                          ({count} / {technicians.length} techniciens évalués)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--empty">—</span>
                  )}
                </td>
              )
            })}
            <td className="portal-dps-matrix-col-total portal-dps-matrix-foot-grand-total">
              {grandAverage != null ? (
                <div className="portal-dps-matrix-score-wrap">
                  <span className={`portal-dps-matrix-score portal-dps-matrix-score--grand ${evalScoreTierClass(evalScoreTier(grandAverage))}`}>
                    {grandAverage}%
                  </span>
                  <div className="portal-dps-matrix-popover" role="tooltip">
                    <div className="portal-dps-popover-header">
                      <span className="portal-dps-popover-brand">Moyenne globale {metierLabel}</span>
                    </div>
                    <div className="portal-dps-popover-hint">
                      Moyenne générale consolidée : <strong>{grandAverage}%</strong>
                      <br />
                      ({technicians.length} techniciens en {metierLabel})
                    </div>
                  </div>
                </div>
              ) : (
                <span className="portal-dps-matrix-status-pill portal-dps-matrix-status-pill--empty">—</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}


