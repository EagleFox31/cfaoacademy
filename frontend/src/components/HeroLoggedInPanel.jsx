import { Link } from 'react-router-dom'
import useLocale from '../hooks/useLocale.js'
import { LMS_BY_USER } from '../data/mock_lms.js'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import {
  resolveProfileAgencyLabel,
  resolveProfileFilialeLabel,
  resolveProfilePays,
} from '../utils/profileOrg.js'
import { flagCdnUrlForCountry } from '../utils/countryFlag.js'

const BRAND_LOGOS = {
  toyota:          '/assets/logos/toyota.png',
  mercedes:        '/assets/logos/mercedes.png',
  suzuki:          '/assets/logos/suzuki.png',
  mitsubishi:      '/assets/logos/mitsubishi.png',
  fuso:            '/assets/logos/fuso.png',
  hino:            '/assets/logos/hino.png',
  byd:             '/assets/logos/byd.png',
  citroen:         '/assets/logos/citroen.png',
  yamaha:          '/assets/logos/yamaha.png',
  'renault-trucks':'/assets/logos/renault-trucks.png',
}

const ROLE_PRIORITY = [
  'superadmin','branch_hr','branch_admin','group_hr','group_admin',
  'workshop_manager','team_manager','ki','pic',
  'trainer','center_director','dop','dps','branch_director',
]

function getPrimaryRole(roles) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return 'learner'
}

/** Agence ou filiale — toujours avec drapeau pays quand `pays` est connu (norme site). */
function HeroGeoContextBadge({ pays, label }) {
  if (!label) return null
  const flagSrc = pays ? flagCdnUrlForCountry(pays, 40) : null

  return (
    <span className="hero-logged-badge-context">
      {flagSrc ? (
        <img
          src={flagSrc}
          srcSet={`${flagCdnUrlForCountry(pays, 80)} 2x`}
          alt=""
          className="hero-logged-badge-flag"
          width={20}
          height={15}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span>{label}</span>
    </span>
  )
}

/** Badge rôle + agence/filiale — affiché en haut du hero connecté. */
export function HeroLoggedInBadge({ user }) {
  const { t: heroT } = useLocale('hero')
  const { t: pt } = useLocale('portal')
  const { t: publicsT } = useLocale('publics')
  const primaryRole = getPrimaryRole(user.roles)
  const baseRoleLabel = pt[`role_${primaryRole}`] || primaryRole
  const roleLabel = primaryRole === 'learner'
    ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
    : baseRoleLabel
  const pays = resolveProfilePays(user)
  const contextLabel = resolveProfileAgencyLabel(user) ?? resolveProfileFilialeLabel(user)

  return (
    <div className="hero-logged-badge">
      <span className="hero-logged-badge-role">{roleLabel}</span>
      <HeroGeoContextBadge pays={pays} label={contextLabel} />
    </div>
  )
}

function BrandChips({ brands }) {
  return (
    <div className="hero-logged-brands">
      {brands.map(b => {
        const src = BRAND_LOGOS[b]
        return src ? (
          <span key={b} className="hero-logged-brand-wrap">
            <img src={src} alt={b} className="hero-logged-brand-img" />
          </span>
        ) : (
          <span key={b} className="hero-logged-brand-text">{b}</span>
        )
      })}
    </div>
  )
}

/* ── Variante apprenant / KI ── */
function LearnerPanel({ user, lms, t, pt }) {
  const certGoal = lms?.certGoals?.[0]
  const inProgressModule = lms?.modules?.find(m => m.status === 'progress')
  const certCount = lms?.certifications?.length ?? 0

  const progress = certGoal ? resolveCertGoalPrerequisites(user, lms, certGoal) : null
  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  const primaryLabel = inProgressModule ? t.logged_cta_continue : t.logged_cta_portal

  return (
    <>
      <div className="hero-logged-meta">
        <BrandChips brands={user.brands || []} />
        {certGoal && (
          <span className="hero-logged-cert-chip">
            {certGoal.currentLevel ?? '—'} → {certGoal.targetLevel}
          </span>
        )}
      </div>

      {certGoal && (
        <div className="hero-logged-progress-block">
          <div className="hero-logged-progress-head">
            <span className="hero-logged-progress-label">
              {t.logged_goal.replace('{level}', certGoal.targetLevel)}
              {certGoal.targetDate && (
                <span className="hero-logged-progress-date"> · {certGoal.targetDate}</span>
              )}
            </span>
            <span className="hero-logged-progress-pct">{pct}%</span>
          </div>
          <div className="hero-logged-track">
            <div className="hero-logged-fill" style={{ width: `${pct}%` }} />
          </div>
          {inProgressModule && (
            <p className="hero-logged-module-hint">
              {inProgressModule.title} · {inProgressModule.progress}%
            </p>
          )}
          {!inProgressModule && certCount > 0 && (
            <p className="hero-logged-module-hint">
              {certCount} {certCount > 1 ? t.logged_certs_pl : t.logged_certs}
            </p>
          )}
        </div>
      )}

      <div className="hero-logged-ctas">
        <Link to="/portail" className="hero-logged-cta-primary">
          {primaryLabel}
          <span aria-hidden="true">→</span>
        </Link>
        <a href="#offres" className="hero-logged-cta-secondary">
          {t.logged_browse}
        </a>
      </div>
    </>
  )
}

/* ── Variante chef d'équipe / chef d'atelier ── */
function TeamPanel({ user, lms, t, pt }) {
  const members = lms?.team ?? lms?.teams?.flatMap(te => te.membres) ?? []
  const alertCount = members.filter(m => m.alert).length
  const avgProgress = members.length
    ? Math.round(members.reduce((s, m) => s + m.progress, 0) / members.length)
    : 0

  return (
    <>
      <div className="hero-logged-meta">
        <BrandChips brands={user.brands || []} />
        <span className="hero-logged-team-stat">
          <strong>{members.length}</strong>{' '}
          {members.length > 1 ? pt.kpi_collaborators : pt.tm_hero_member_one}
        </span>
        {alertCount > 0 && (
          <span className="hero-logged-team-alert">
            {alertCount} {alertCount > 1 ? pt.kpi_inactive_alerts_pl : pt.kpi_inactive_alerts}
          </span>
        )}
        <span className="hero-logged-team-stat">
          {t.logged_avg_progress} <strong>{avgProgress}%</strong>
        </span>
      </div>

      <div className="hero-logged-ctas">
        <Link to="/portail" className="hero-logged-cta-primary">
          {t.logged_cta_portal}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  )
}

/* ── Variante générique (RH, admin, etc.) ── */
function GenericPanel({ user, t }) {
  return (
    <>
      <div className="hero-logged-ctas">
        <Link to="/portail" className="hero-logged-cta-primary">
          {t.logged_cta_portal}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  )
}

/* ── Composant principal ── */
export default function HeroLoggedInPanel({ user }) {
  const { t } = useLocale('hero')
  const { t: pt } = useLocale('portal')
  const lms = LMS_BY_USER[user.demoKey]
  const primaryRole = getPrimaryRole(user.roles)

  const isLearner    = primaryRole === 'learner' || primaryRole === 'ki'
  const isTeamMgr    = primaryRole === 'team_manager' || primaryRole === 'workshop_manager'

  return (
    <div className="hero-logged-panel">
      {isLearner  && <LearnerPanel user={user} lms={lms} t={t} pt={pt} />}
      {isTeamMgr  && <TeamPanel   user={user} lms={lms} t={t} pt={pt} />}
      {!isLearner && !isTeamMgr && <GenericPanel user={user} t={t} />}
    </div>
  )
}
