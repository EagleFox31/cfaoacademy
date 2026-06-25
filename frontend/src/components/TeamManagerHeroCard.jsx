import useLocale from '../hooks/useLocale'
import {
  computeTeamCompetencyMetrics,
  computeTeamPathwayMetrics,
  getTeamPendingValidations,
  resolveTeamMembers,
} from '../utils/teamManagerMetrics.js'

function HeroProgress({ label, pct, detail, accent = 'var(--red)' }) {
  return (
    <div className="portal-header-team-progress">
      <div className="portal-header-team-progress-head">
        <span className="portal-header-team-progress-lbl">{label}</span>
        <span className="portal-header-team-progress-pct">{pct}%</span>
      </div>
      <div
        className="portal-header-team-progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${pct}%`}
      >
        <div
          className="portal-header-team-progress-fill"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      {detail && <p className="portal-header-team-progress-detail">{detail}</p>}
    </div>
  )
}

/** Panneau hero chef d'équipe — mesure compétences + parcours formation. */
export default function TeamManagerHeroCard({ lms, workshop = false }) {
  const { t } = useLocale('portal')
  const members = resolveTeamMembers(lms, { workshop })
  const competency = computeTeamCompetencyMetrics(members)
  const pathway = computeTeamPathwayMetrics(members)
  const alertCount = members.filter(m => m.alert).length
  const pendingTestCount = getTeamPendingValidations(lms).length

  const competencyDetail = competency.total > 0
    ? t.tm_hero_competency_detail
      .replace('{done}', String(competency.done))
      .replace('{total}', String(competency.total))
    : null

  const pathwayDetail = pathway.total > 0
    ? t.tm_hero_pathway_detail
      .replace('{done}', String(pathway.done))
      .replace('{total}', String(pathway.total))
    : null

  const memberCount = members.length
  const memberLabel = memberCount > 1 ? t.kpi_collaborators : t.tm_hero_member_one

  return (
    <aside className="portal-header-team-card" aria-label={t.tm_hero_title}>
      <p className="portal-header-team-card-title">{t.tm_hero_title}</p>

      <p className="portal-header-team-card-meta">
        {memberCount} {memberLabel}
        {alertCount > 0 && (
          <>
            {' · '}
            {alertCount} {alertCount > 1 ? t.kpi_inactive_alerts_pl : t.kpi_inactive_alerts}
          </>
        )}
      </p>

      <HeroProgress
        label={t.tm_hero_competency_label}
        pct={competency.pct}
        detail={competencyDetail}
        accent="#1a56db"
      />

      <HeroProgress
        label={t.tm_hero_pathway_label}
        pct={pathway.pct}
        detail={pathwayDetail}
        accent="var(--red)"
      />

      {(pendingTestCount > 0 || alertCount > 0) && (
        <div className="portal-header-team-urgency">
          {pendingTestCount > 0 && (
            <a href="#next-actions" className="portal-header-team-urgency-link">
              {pendingTestCount > 1
                ? t.tm_hero_urgency_tests_pl.replace('{count}', String(pendingTestCount))
                : t.tm_hero_urgency_tests.replace('{count}', String(pendingTestCount))}
            </a>
          )}
          {pendingTestCount > 0 && alertCount > 0 && (
            <span className="portal-header-team-urgency-sep" aria-hidden="true">·</span>
          )}
          {alertCount > 0 && (
            <a href="#equipe" className="portal-header-team-urgency-link">
              {alertCount > 1
                ? t.tm_hero_urgency_alerts_pl.replace('{count}', String(alertCount))
                : t.tm_hero_urgency_alerts.replace('{count}', String(alertCount))}
            </a>
          )}
        </div>
      )}

      <a href="#equipe" className="portal-header-team-card-cta">{t.tm_hero_see_team}</a>
    </aside>
  )
}
