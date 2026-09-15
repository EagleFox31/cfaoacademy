import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import { useState } from 'react'
import PvCard from './PvCard.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import { computeTeamResultsByGroup } from '../utils/teamManagerMetrics.js'

function SummaryCard({ title, stats, t, accentColor }) {
  const detail = t.tm_results_summary_detail
    .replace('{done}', String(stats.done))
    .replace('{total}', String(stats.total))

  return (
    <PvCard
      kicker={(
        <span className="portal-status-chip kind-competency">{title}</span>
      )}
      title={`${stats.pct}%`}
      meta={detail}
      cta={t.tm_results_view_detail}
      accentColor={accentColor}
      hoverHint={t.plan_entry_coming_soon}
      corner
    />
  )
}

export default function TeamResultsSection({ members, t }) {
  const [openCompetency, setOpenCompetency] = useState(true)
  const [openFormation, setOpenFormation] = useState(false)
  const groups = computeTeamResultsByGroup(members)

  return (
    <section id="resultats">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="award" label={t.eyebrow_skills} />
          <h2 className="portal-section-title">{t.tm_title_results}</h2>
        </div>

        <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch" style={{ marginBottom: 24 }}>
          <PlanEntryCard
            kind="results"
            title={t.tm_results_hub_title}
            desc={t.tm_results_hub_desc}
            meta={t.tm_results_hub_meta.replace('{count}', String(members.length))}
            cta={t.plan_entry_open}
            hoverHint={t.plan_entry_coming_soon}
            accentColor="#475569"
          />
        </div>

        <div className="portal-plan-subsections">
          <div className={`portal-plan-subsection portal-test-subsection${openCompetency ? ' is-open' : ' is-collapsed'}`}>
            <button
              type="button"
              className="portal-plan-subsection-head"
              onClick={() => setOpenCompetency(v => !v)}
              aria-expanded={openCompetency}
            >
              <span className="portal-plan-subsection-title">{t.test_group_competency}</span>
              <span className="portal-plan-subsection-count">{groups.competency.total}</span>
              <span className="portal-plan-subsection-chevron" aria-hidden="true" />
            </button>
            <div className="portal-plan-subsection-body" hidden={!openCompetency}>
              <div className="pv-grid cols-4 pv-grid--stretch">
                <SummaryCard
                  title={t.test_group_competency}
                  stats={groups.competency}
                  t={t}
                  accentColor="#1a56db"
                />
              </div>
            </div>
          </div>

          <div className={`portal-plan-subsection portal-test-subsection${openFormation ? ' is-open' : ' is-collapsed'}`}>
            <button
              type="button"
              className="portal-plan-subsection-head"
              onClick={() => setOpenFormation(v => !v)}
              aria-expanded={openFormation}
            >
              <span className="portal-plan-subsection-title">{t.test_kind_formation}</span>
              <span className="portal-plan-subsection-count">{groups.formation.total}</span>
              <span className="portal-plan-subsection-chevron" aria-hidden="true" />
            </button>
            <div className="portal-plan-subsection-body" hidden={!openFormation}>
              <div className="pv-grid cols-4 pv-grid--stretch">
                <SummaryCard
                  title={t.test_kind_formation}
                  stats={groups.formation}
                  t={t}
                  accentColor="var(--red)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
