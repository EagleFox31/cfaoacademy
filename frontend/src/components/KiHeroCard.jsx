import useLocale from '../hooks/useLocale'
import FadStatusBadge from './FadStatusBadge.jsx'
import { resolveKiNextActions } from './KiNextActions.jsx'

const BRAND_LOGOS = {
  toyota: '/assets/logos/toyota.png',
  mercedes: '/assets/logos/mercedes.png',
  suzuki: '/assets/logos/suzuki.png',
}

function BrandLogo({ brand }) {
  const src = BRAND_LOGOS[brand]
  if (!src) {
    return <span className={`portal-brand-chip ${brand}`}>{brand}</span>
  }
  return (
    <span className="portal-header-brand-logo-wrap" title={brand}>
      <img src={src} alt={brand} className="portal-header-brand-logo" />
    </span>
  )
}

/** Panneau hero KI — prochaine session + synthèse terrain. */
export default function KiHeroCard({ user, lms }) {
  const { t } = useLocale('portal')
  const nextActions = resolveKiNextActions(lms)
  const nextFad = nextActions[0]?.data
  const kiResults = lms?.kiResults ?? {}
  const appCount = lms?.apprenants?.length ?? 0
  const instructorBrands = user.instructorBrands?.length
    ? user.instructorBrands
    : user.brands ?? []
  const certGoal = lms?.certGoals?.[0]

  const learnerLabel = nextFad?.apprenants > 1 ? t.ki_learners_pl : t.ki_learners

  return (
    <aside className="portal-header-ki-card" aria-label={t.ki_hero_title}>
      <p className="portal-header-ki-card-title">{t.ki_hero_title}</p>

      <div className="portal-header-ki-card-brands">
        {instructorBrands.map(brand => (
          <BrandLogo key={brand} brand={brand} />
        ))}
        <span className="portal-header-ki-card-role">{t.ki_instructor_for.replace(/ —$/, '')}</span>
      </div>

      {nextFad ? (
        <div className="portal-header-ki-card-session">
          <p className="portal-header-ki-card-session-lbl">{t.ki_hero_next_session}</p>
          <p className="portal-header-ki-card-session-title">{nextFad.title}</p>
          <p className="portal-header-ki-card-session-meta">
            {nextFad.date}
            {' · '}
            {nextFad.apprenants} {learnerLabel}
          </p>
          <FadStatusBadge statut={nextFad.statut} label={t.fad_planned} chip />
        </div>
      ) : (
        <p className="portal-header-ki-card-empty">{t.ki_hero_no_session}</p>
      )}

      <ul className="portal-header-ki-card-stats">
        <li>
          <strong>{appCount}</strong>
          <span>{appCount > 1 ? t.ki_learners_pl : t.ki_learners}</span>
        </li>
        {kiResults.testsValidated != null && (
          <li>
            <strong>{kiResults.testsValidated}</strong>
            <span>{t.kpi_ki_tests_validated}</span>
          </li>
        )}
        {kiResults.avgScore != null && (
          <li>
            <strong>{kiResults.avgScore}%</strong>
            <span>{t.kpi_ki_avg_score}</span>
          </li>
        )}
      </ul>

      <a href="#fad" className="portal-header-ki-card-cta">{t.ki_hero_see_sessions}</a>

      {certGoal && (
        <a href="#parcours" className="portal-header-ki-card-personal">
          {t.ki_hero_personal_path}
          {' '}
          <strong>{certGoal.currentLevel ?? '—'} → {certGoal.targetLevel}</strong>
          {certGoal.targetDate && (
            <span className="portal-header-ki-card-personal-date">
              {' '}· {certGoal.targetDate}
            </span>
          )}
        </a>
      )}
    </aside>
  )
}
