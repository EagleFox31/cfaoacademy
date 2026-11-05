import { useCallback, useMemo, useState } from 'react'
import PageHeaderClose from '../../components/PageHeaderClose.jsx'
import DefineTechnicianFilterBar from '../../medacap/define/technician/DefineTechnicianFilterBar.jsx'
import DefineTechnicianKpiCards from '../../medacap/define/technician/DefineTechnicianKpiCards.jsx'
import DefineTechnicianMeasureChart from '../../medacap/define/technician/DefineTechnicianMeasureChart.jsx'
import { DEFAULT_DEFINE_FILTERS, resolveTechnicianDefinePlan } from '../../medacap/define/technician/resolveTechnicianDefinePlan.js'
import { resolveTeamgpElearningForTechnician } from '../../utils/teamgpElearning.js'

export default function DpsTechnicianPifDetailView({
  shellRef,
  lms,
  technicianKey,
  t,
  onBack,
  showTeamgpElearning = false,
}) {
  const [filters, setFilters] = useState(DEFAULT_DEFINE_FILTERS)

  const plan = useMemo(
    () => resolveTechnicianDefinePlan(lms, technicianKey, filters),
    [lms, technicianKey, filters],
  )

  const elearning = useMemo(() => {
    if (!showTeamgpElearning || !plan?.technician) return null
    return resolveTeamgpElearningForTechnician(plan.technician.id)
  }, [showTeamgpElearning, plan?.technician])

  const chartSeriesWithTeamgp = useMemo(() => {
    const base = plan?.chartSeries ?? []
    if (!elearning?.linked || elearning.pct == null) return base
    return [
      ...base,
      {
        brandId: 'teamgp',
        label: 'TEAM-GP',
        measureScore: elearning.pct,
        volume: elearning.required ?? elearning.done ?? 1,
        logo: '/assets/logos/teamgp.png',
        captionKind: 'elearning',
      },
    ]
  }, [plan?.chartSeries, elearning])

  const handleFilterChange = useCallback(patch => {
    setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  if (!plan) return null

  const {
    technician,
    kpis,
    levelOptions,
    chartLevelToggles,
    scopeOptions,
    brandOptions,
  } = plan
  const brandCount = technician.brands?.length ?? brandOptions.filter(opt => opt.value !== 'all').length
  const animationKey = `${filters.brand}|${filters.level}|${filters.scope}|${filters.volumeStatus}|teamgp`

  const handleVolumeStatusChange = useCallback(volumeStatus => {
    setFilters(prev => ({ ...prev, volumeStatus }))
  }, [])

  return (
    <div ref={shellRef} className="define-tech-dashboard-shell">
      <PageHeaderClose
        onClick={onBack}
        ariaLabel={t.medacap_define_back}
      />
      <div className="container define-tech-dashboard">
        <DefineTechnicianFilterBar
          filters={filters}
          brandOptions={brandOptions}
          levelOptions={levelOptions}
          scopeOptions={scopeOptions}
          technician={technician}
          brandCount={brandCount}
          animationKey={animationKey}
          onChange={handleFilterChange}
          t={t}
        />

        <section className="define-tech-measure-stack">
          <div className="define-tech-kpi-stack">
            <div className="define-tech-volume-head" aria-labelledby="define-tech-volume-title">
              <span className="define-tech-volume-head-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 14l4-4 4 3 6-7 4 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 id="define-tech-volume-title">{t.medacap_define_volume_title}</h2>
            </div>

            <DefineTechnicianKpiCards
              kpis={kpis}
              activeVolumeStatus={filters.volumeStatus}
              onVolumeStatusChange={handleVolumeStatusChange}
              animationKey={animationKey}
              elearning={elearning}
              t={t}
            />
          </div>

          <DefineTechnicianMeasureChart
            series={chartSeriesWithTeamgp}
            filters={filters}
            levelToggles={chartLevelToggles}
            animationKey={animationKey}
            onLevelChange={handleFilterChange}
            t={t}
          />
        </section>
      </div>
    </div>
  )
}
