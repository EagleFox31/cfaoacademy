import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'

export default function DpsOverviewSection({ kpis, t }) {
  if (!kpis) return null

  const metrics = [
    {
      id: 'tech',
      kind: 'learners',
      title: String(kpis.totalTechnicians),
      desc: t.dps_kpi_technicians,
      accent: 'var(--navy)',
    },
    {
      id: 'measured',
      kind: 'results',
      title: `${kpis.measuredPct}%`,
      desc: t.dps_kpi_measured,
      accent: kpis.measuredPct >= 80 ? '#1aab5b' : 'var(--red)',
    },
    {
      id: 'pif',
      kind: 'pif',
      title: `${kpis.withTrainingPct}%`,
      desc: t.dps_kpi_with_pif,
      accent: '#1a56db',
    },
    {
      id: 'validated',
      kind: 'results',
      title: `${kpis.validatedTrainingPct}%`,
      desc: t.dps_kpi_validated_pif,
      accent: kpis.validatedTrainingPct >= 60 ? '#1aab5b' : '#e67e00',
    },
    {
      id: 'junior',
      kind: 'pif',
      title: String(kpis.juniorCount),
      desc: t.dps_level_junior,
      accent: '#475569',
      statusChip: <span className="portal-status-chip progress">{t.dps_level_junior}</span>,
    },
    {
      id: 'senior',
      kind: 'pif',
      title: String(kpis.seniorCount),
      desc: t.dps_level_senior,
      accent: '#1a56db',
      statusChip: <span className="portal-status-chip done">{t.dps_level_senior}</span>,
    },
    {
      id: 'expert',
      kind: 'pif',
      title: String(kpis.expertCount),
      desc: t.dps_level_expert,
      accent: '#1aab5b',
      statusChip: <span className="portal-status-chip done">{t.dps_level_expert}</span>,
    },
  ]

  return (
    <PortalReveal id="vue-filiale">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="building" label={t.eyebrow_dps_scope} />
          <h2 className="portal-section-title">{t.title_dps_dashboard}</h2>
        </div>

        <PortalStaggerGrid>
          {metrics.map(item => (
            <div key={item.id} className="portal-card-anchor">
              <PlanEntryCard
                kind={item.kind}
                title={item.title}
                desc={item.desc}
                cta={t.card_view_detail}
                accentColor={item.accent}
                statusChip={item.statusChip}
                hoverHint={t.plan_entry_coming_soon}
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
