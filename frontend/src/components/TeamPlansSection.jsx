import PlanEntryCard from './PlanEntryCard.jsx'
import TeamMemberCard from './TeamMemberCard.jsx'
import { countTeamPlansInProgress } from '../utils/teamManagerMetrics.js'

function scrollToTeamMember(memberId) {
  document.getElementById(`team-member-${memberId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function TeamPlansSection({ members, t, planYear }) {
  const sessionsCount = countTeamPlansInProgress(members, planYear)
  const behind = members.filter(m => (m.progress ?? 0) < 50 && !m.certified).slice(0, 3)

  return (
    <section id="plans">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_plan}</p>
          <h2 className="portal-section-title">{t.tm_title_plans}</h2>
        </div>

        <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch">
          <PlanEntryCard
            kind="pif"
            title={t.tm_plans_pif_title}
            desc={t.tm_plans_pif_desc}
            meta={t.tm_plans_pif_meta.replace('{count}', String(members.length))}
            cta={t.plan_entry_open}
            hoverHint={t.plan_entry_coming_soon}
            accentColor="var(--red)"
          />
          <PlanEntryCard
            kind="planning"
            title={t.tm_plans_scheduling_title.replace('{year}', String(planYear))}
            desc={t.tm_plans_scheduling_desc}
            meta={t.tm_plans_scheduling_meta.replace('{count}', String(sessionsCount))}
            cta={t.plan_entry_open}
            hoverHint={t.plan_entry_coming_soon}
            accentColor="#1a56db"
          />
        </div>

        {behind.length > 0 && (
          <div className="portal-team-plans-preview">
            <p className="portal-team-plans-preview-lbl">{t.tm_plans_preview_lbl}</p>
            <div className="pv-grid cols-4 pv-grid--stretch">
              {behind.map(m => (
                <div key={m.id} className="portal-card-anchor">
                  <TeamMemberCard
                    member={m}
                    t={t}
                    onFiche={() => scrollToTeamMember(m.id)}
                    onManage={() => scrollToTeamMember(m.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
