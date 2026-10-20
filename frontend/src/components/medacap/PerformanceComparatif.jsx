import { useMemo, useState } from 'react'
import PortalReveal from '../PortalReveal.jsx'
import PortalSectionEyebrow from '../PortalSectionEyebrow.jsx'
import PortalSectionHead from '../PortalSectionHead.jsx'
import PortalStaggerGrid from '../PortalStaggerGrid.jsx'
import PlanEntryCard from '../PlanEntryCard.jsx'

/**
 * Comparatif période N vs N-1 — étape MEDACAP « Performer ».
 * KPIs et comparatifs filiales rendus en grille PlanEntryCard homogène DPS.
 */
export default function PerformanceComparatif({
  scope = 'branch',
  lms,
  t,
  compare = false,
  updatedAt,
  sectionId = 'performance',
}) {
  const [period, setPeriod] = useState('quarter')
  const kpis = useMemo(() => buildKpis(lms, scope, period), [lms, scope, period])

  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={
            <PortalSectionEyebrow
              icon="trending-up"
              label={t[`perf_eyebrow_${scope}`] ?? t.perf_eyebrow_default}
            />
          }
          title={t[`perf_title_${scope}`] ?? t.perf_title_default}
          updatedAt={updatedAt}
          methodText={t.perf_method}
          t={t}
        />

        <div className="portal-period-pills">
          <button
            type="button"
            className={`portal-period-pill ${period === 'quarter' ? 'is-active' : ''}`}
            onClick={() => setPeriod('quarter')}
          >
            {t.perf_period_quarter}
          </button>
          <button
            type="button"
            className={`portal-period-pill ${period === 'year' ? 'is-active' : ''}`}
            onClick={() => setPeriod('year')}
          >
            {t.perf_period_year}
          </button>
        </div>

        {/* KPIs — grille PlanEntryCard homogène (pas de custom card) */}
        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {kpis.map(k => (
            <PlanEntryCard
              key={k.id}
              kind="results"
              title={`${k.value}${k.unit ?? ''}`}
              statusChip={<DeltaChip value={k.delta} />}
              meta={(
                <div className="portal-plan-entry-meta">
                  <p><strong>{t[k.labelKey] ?? k.labelKey}</strong></p>
                  <p style={{ opacity: 0.7 }}>
                    {t.perf_prev_period}: {k.previous}{k.unit ?? ''}
                  </p>
                </div>
              )}
              accentColor={deltaAccent(k.delta)}
              corner={false}
            />
          ))}
        </PortalStaggerGrid>

        {/* Comparatif inter-filiales — grille de cards, pas de tableau */}
        {compare && lms?.filialesStats?.length ? (
          <>
            <div className="portal-section-subhead">
              <PortalSectionEyebrow icon="building" label={t.perf_compare_branches_title} />
            </div>
            <PortalStaggerGrid className="cols-3 pv-grid--stretch">
              {lms.filialesStats.map(f => (
                <PlanEntryCard
                  key={f.filiale}
                  kind="results"
                  title={f.filiale}
                  flagSrc={f.flagSrc}
                  countryFlag={f.countryCode ?? f.filiale}
                  statusChip={
                    <span className={`portal-status-chip ${f.pct >= 50 ? 'done' : 'progress'}`}>
                      {f.pct}%
                    </span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta">
                      <p><strong>{t.perf_col_cert_rate}</strong> · {f.pct}%</p>
                      <div className="portal-inline-bar" style={{ marginTop: 6 }}>
                        <div className="portal-inline-track">
                          <div
                            className="portal-inline-fill"
                            style={{
                              width: `${f.pct}%`,
                              background: f.pct >= 50 ? '#1aab5b' : undefined,
                            }}
                          />
                        </div>
                      </div>
                      <p style={{ marginTop: 6 }}>
                        <DeltaChip value={f.delta ?? 0} />
                        <span style={{ marginLeft: 8, opacity: 0.7 }}>{t.perf_col_delta}</span>
                      </p>
                    </div>
                  )}
                  accentColor={f.pct >= 50 ? '#1aab5b' : '#1a56db'}
                  corner={false}
                />
              ))}
            </PortalStaggerGrid>
          </>
        ) : null}
      </div>
    </PortalReveal>
  )
}

function DeltaChip({ value }) {
  const n = Number(value ?? 0)
  const sign = n > 0 ? '+' : ''
  const tone = n > 0 ? 'done' : n < 0 ? 'accent' : 'muted'
  return (
    <span className={`portal-status-chip ${tone}`}>
      {sign}{n.toFixed(1)}
    </span>
  )
}
function deltaAccent(n) {
  if (n > 0) return '#1aab5b'
  if (n < 0) return '#e11d48'
  return '#94a3b8'
}

function buildKpis(lms, scope, period) {
  if (scope === 'group') {
    return [
      { id: 'cert',   labelKey: 'kpi_cert_rate',           value: pct(lms?.globalKpis?.tauxCertification), previous: 46,   delta: 3.2, unit: '%' },
      { id: 'active', labelKey: 'kpi_active_learners',     value: lms?.globalKpis?.totalApprenants ?? 0,  previous: 4180, delta: 5.5 },
      { id: 'sess',   labelKey: 'kpi_active_sessions',     value: lms?.globalKpis?.sessionsActives ?? 0,  previous: 22,   delta: -2.1 },
    ]
  }
  if (scope === 'branch') {
    return [
      { id: 'cert',    labelKey: 'kpi_cert_rate',              value: 52, previous: 47, delta: 5.0, unit: '%' },
      { id: 'pif',     labelKey: 'perf_kpi_pif_completion',    value: 68, previous: 61, delta: 7.0, unit: '%' },
      { id: 'active',  labelKey: 'kpi_active_training',        value: 42, previous: 39, delta: 3.0 },
      { id: 'measure', labelKey: 'perf_kpi_measure_coverage',  value: 78, previous: 71, delta: 7.0, unit: '%' },
    ]
  }
  if (scope === 'team') {
    return [
      { id: 'progress', labelKey: 'kpi_avg_progress',         value: 64, previous: 58, delta: 6.0, unit: '%' },
      { id: 'cert',     labelKey: 'kpi_certified_pl',         value: 3,  previous: 2,  delta: 1 },
      { id: 'pif',      labelKey: 'perf_kpi_pif_completion',  value: 71, previous: 66, delta: 5.0, unit: '%' },
    ]
  }
  return [
    { id: 'progress', labelKey: 'kpi_global_progress',        value: 62, previous: 55, delta: 7.0, unit: '%' },
    { id: 'mods',     labelKey: 'kpi_modules_completed',      value: 8,  previous: 5,  delta: 3 },
    { id: 'evals',    labelKey: 'perf_kpi_measure_score',     value: 76, previous: 71, delta: 5.0, unit: '%' },
  ]
}
function pct(n) { const v = Number(n); return Number.isFinite(v) ? v : 0 }
