import PortalReveal from './PortalReveal.jsx'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import { DpsProgressMeta } from './DpsStatCard.jsx'
import { pct } from '../utils/dpsMetrics.js'

export default function DpsPifSection({ pifByLevel, t }) {
  if (!pifByLevel?.length) return null

  return (
    <PortalReveal id="pif">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="milestone" className="portal-pif-eyebrow">
            <span className="portal-pif-eyebrow-kicker">{t.eyebrow_pif}</span>
            {' '}
            <span className="portal-pif-eyebrow-expansion">{t.eyebrow_pif_expansion}</span>
          </PortalSectionEyebrow>
          <h2 className="portal-section-title">{t.dps_title_pif_levels}</h2>
        </div>

        <PortalStaggerGrid className="cols-3">
          {pifByLevel.map(row => {
            const validatedPct = pct(row.pifValidated, row.pifProposed)
            const accent = validatedPct >= 70 ? '#1aab5b' : validatedPct >= 50 ? '#e67e00' : 'var(--red)'

            return (
              <div key={row.level} className="portal-card-anchor">
                <PlanEntryCard
                  kind="pif"
                  title={`${validatedPct}%`}
                  desc={t.dps_pif_tests.replace('{count}', row.testsDone)}
                  meta={(
                    <DpsProgressMeta
                      label={t.dps_th_pif_validated}
                      value={`${row.pifValidated} / ${row.pifProposed}`}
                      pct={validatedPct}
                      accent={accent}
                    />
                  )}
                  statusChip={(
                    <span className="portal-status-chip progress">{row.level}</span>
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
