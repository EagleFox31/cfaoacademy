import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import { DpsProgressMeta, DpsSubcardRow } from './DpsStatCard.jsx'
import { dpsTechnicianHeadcountLine } from '../utils/dpsMetrics.js'

export default function DpsAgencySection({ agencies, t }) {
  if (!agencies?.length) return null

  return (
    <PortalReveal id="agences">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="users" label={t.eyebrow_field} />
          <h2 className="portal-section-title">{t.dps_title_by_agency}</h2>
        </div>

        <PortalStaggerGrid>
          {agencies.map(a => {
            const accent = a.measuredPct >= 85 ? '#1aab5b' : a.measuredPct >= 70 ? '#e67e00' : 'var(--red)'

            return (
              <div key={a.id} className="portal-card-anchor">
                <PlanEntryCard
                  kind="learners"
                  title={a.name}
                  desc={dpsTechnicianHeadcountLine(a.technicians, t)}
                  meta={(
                    <div className="portal-team-member-subcards">
                      <DpsSubcardRow
                        items={[
                          { label: t.dps_level_junior, value: String(a.junior) },
                          { label: t.dps_level_senior, value: String(a.senior) },
                          { label: t.dps_level_expert, value: String(a.expert) },
                        ]}
                      />
                      <DpsProgressMeta
                        label={t.dps_kpi_measured}
                        pct={a.measuredPct}
                        accent={accent}
                      />
                    </div>
                  )}
                  statusChip={(
                    <span className={`portal-status-chip ${a.measuredPct >= 85 ? 'done' : 'progress'}`}>
                      {a.technicians}
                    </span>
                  )}
                  cta={t.card_view_detail}
                  accentColor={accent}
                  hoverHint={t.plan_entry_coming_soon}
                />
              </div>
            )
          })}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
