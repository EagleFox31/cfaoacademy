import { useState } from 'react'
import useLocale from '../hooks/useLocale'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import KiHeroCard from './KiHeroCard.jsx'
import LearnerBrandLevelsStrip from './LearnerBrandLevelsStrip.jsx'
import PortalFilialeFlag from './PortalFilialeFlag.jsx'
import PortalGreetingBlock from './PortalGreetingBlock.jsx'
import TeamManagerHeroCard from './TeamManagerHeroCard.jsx'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'
import { formatCertLevelLabel } from '../utils/portalCertLevel.js'

/* ─── Greeting logic ───────────────────────────────────────────── */

const SPECIAL_DATES = {
  '12-25': 'Joyeux Noël',
  '01-01': 'Bonne année',
  '12-31': 'Bonne fin d\'année',
}

const SPECIAL_DATE_KEYS = { '12-25': 'greeting_xmas', '01-01': 'greeting_newyear', '12-31': 'greeting_nye' }

function computeGreetingKey() {
  const now = new Date()
  const hour = now.getHours()
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const specialKey = SPECIAL_DATE_KEYS[mmdd]
  if (specialKey) return specialKey

  const isReturn = sessionStorage.getItem('cfao_portal_visited') === 'true'
  if (!isReturn) sessionStorage.setItem('cfao_portal_visited', 'true')
  if (isReturn) return 'greeting_return'

  if (hour >= 5  && hour < 12) return 'greeting_morning'
  if (hour >= 12 && hour < 18) return 'greeting_afternoon'
  return 'greeting_evening'
}

/* ─── Assets maps ──────────────────────────────────────────────── */

const BRAND_LOGOS = {
  toyota:    '/assets/logos/toyota.png',
  mercedes:  '/assets/logos/mercedes.png',
  suzuki:    '/assets/logos/suzuki.png',
  mitsubishi:'/assets/logos/mitsubishi.png',
  byd:       '/assets/logos/byd.png',
  citroen:   '/assets/logos/citroen.png',
  yamaha:    '/assets/logos/yamaha.png',
  fuso:      '/assets/logos/fuso.png',
  hino:      '/assets/logos/hino.png',
  jcb:       '/assets/logos/jcb.png',
  lovol:     '/assets/logos/lovol.png',
  'renault-trucks': '/assets/logos/renault-trucks.png',
  'king-long': '/assets/logos/kinglong.png',
}

const ROLE_LABELS = {
  learner:          'Apprenant',
  ki:               'Key Instructor',
  pic:              'Formateur suppléant',
  team_manager:     "Chef d'équipe",
  workshop_manager: "Chef d'atelier",
  dps:              'Dir. Pièces & Services',
  dop:              'Dir. des Opérations',
  branch_director:  'Directeur Filiale',
  branch_hr:        'RH Filiale',
  branch_admin:     'Admin Filiale',
  group_admin:      'Admin Groupe',
  group_hr:         'RH Groupe',
  superadmin:       'Super Admin',
  trainer:          'Formateur',
  center_director:  'Dir. Centre de formation',
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

function RoleIcon({ role }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

  if (role === 'learner') {
    return (
      <svg {...common}>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      </svg>
    )
  }
  if (role === 'ki' || role === 'pic' || role === 'trainer') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-5 3-5-3" />
      </svg>
    )
  }
  if (role === 'team_manager' || role === 'workshop_manager') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/* ─── Sub-components ────────────────────────────────────────────── */

function BrandLogo({ brand, size = 'default' }) {
  const src = BRAND_LOGOS[brand]
  const wrapClass = size === 'geo'
    ? 'portal-header-brand-logo-wrap portal-header-brand-logo-wrap--geo'
    : 'portal-header-brand-logo-wrap'
  if (src) {
    return (
      <span className={wrapClass} title={brand}>
        <img src={src} alt={brand} className="portal-header-brand-logo" />
      </span>
    )
  }
  return (
    <span className={`portal-brand-chip ${brand} portal-header-brand-chip`}>
      {brand}
    </span>
  )
}

/* Masqué pour l'instant — réactiver quand la carte objectif sera retravaillée. */
const SHOW_LEARNER_CERT_CARD = false

function normalizeCertGoals({ certGoals, certGoal, user }) {
  const raw = certGoals?.length ? certGoals : certGoal ? [certGoal] : []
  return raw.map(goal => ({
    ...goal,
    currentLevel: goal.currentLevel ?? user.certLevels?.[goal.brand] ?? null,
  }))
}

function CertGoalCard({ goals, user, lms, t }) {
  if (!goals?.length) return null

  return (
    <aside className="portal-header-cert-card" aria-label={t.cert_goal_label}>
      <p className="portal-header-cert-card-title">{t.cert_goal_label}</p>
      <div className="portal-header-cert-card-list">
        {goals.map((goal, index) => {
          const progress = resolveCertGoalPrerequisites(user, lms, goal)
          const done = progress.fallback
            ? (goal.prerequisitesDone ?? 0)
            : progress.done
          const total = progress.fallback
            ? (goal.prerequisitesTotal ?? 0)
            : progress.total
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const remaining = total - done
          const remainingLabel = remaining > 1 ? t.cert_goal_remaining : t.cert_goal_remaining_one
          const formationsLabel = t.cert_goal_formations_level.replace(
            '{level}',
            formatCertLevelLabel(goal.targetLevel, t),
          )
          const countLabel = t.cert_goal_formations_count
            .replace('{done}', String(done))
            .replace('{total}', String(total))

          return (
            <div
              key={goal.brand}
              className={`portal-header-cert-card-item${index > 0 ? ' portal-header-cert-card-item--sep' : ''}`}
            >
              <div className="portal-header-cert-card-brand">
                <BrandLogo brand={goal.brand} />
              </div>
              <div className="portal-header-cert-card-body">
                <div className="portal-header-cert-card-levels">
                  <span className="portal-header-cert-card-level portal-header-cert-card-level--current">
                    {formatCertLevelLabel(goal.currentLevel, t)}
                    <span className="portal-header-cert-card-level-lbl">{t.cert_goal_current}</span>
                  </span>
                  <span className="portal-header-cert-card-arrow" aria-hidden="true">→</span>
                  <span className="portal-header-cert-card-level portal-header-cert-card-level--target">
                    {formatCertLevelLabel(goal.targetLevel, t)}
                    <span className="portal-header-cert-card-level-lbl">{t.cert_goal_target}</span>
                  </span>
                </div>
                <p className="portal-header-cert-card-prereq">
                  {formationsLabel}{' '}
                  <strong>{countLabel}</strong>
                  {remaining > 0 && (
                    <span className="portal-header-cert-card-remaining">
                      {' '}· {remaining} {remainingLabel}
                    </span>
                  )}
                </p>
                <div className="portal-header-cert-card-progress">
                  <div
                    className="portal-header-cert-card-track"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${t.cert_goal_progress} ${pct}%`}
                  >
                    <div className="portal-header-cert-card-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="portal-header-cert-card-pct">{pct}%</span>
                </div>
                {goal.targetDate && (
                  <p className="portal-header-cert-card-date">
                    {t.cert_goal_target_date} {goal.targetDate}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

/* ─── Main component ────────────────────────────────────────────── */

export default function PortalHeader({ user, certGoals, certGoal, lms, workshop = false }) {
  const { t } = useLocale('portal')
  const { t: heroT } = useLocale('hero')
  const { t: publicsT } = useLocale('publics')
  const [greetingKey] = useState(() => computeGreetingKey())
  const primaryRole = getPrimaryRole(user.roles)
  const userBrands = user.brands || []
  const baseRoleLabel = t[`role_${primaryRole}`] || primaryRole
  const roleLabel = primaryRole === 'learner'
    ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
    : baseRoleLabel
  const resolvedGoals = normalizeCertGoals({ certGoals, certGoal, user })
  const showCertCard = SHOW_LEARNER_CERT_CARD && primaryRole === 'learner' && resolvedGoals.length > 0
  const showBrandLevels = primaryRole === 'learner' && userBrands.length > 0
  const showKiCard = primaryRole === 'ki' && lms
  const showTeamCard = primaryRole === 'team_manager' && lms
  const showWorkshopCard = primaryRole === 'workshop_manager' && lms
  const showSidePanel = showCertCard || showKiCard || showTeamCard || showWorkshopCard
  const showGeoBrands = !showBrandLevels && userBrands.length > 0
  const roleBadge = (
    <span className="portal-header-role-badge">
      <RoleIcon role={primaryRole} />
      {roleLabel}
    </span>
  )
  return (
    <section className={`page-header portal-page-header${showSidePanel ? ' portal-page-header--with-cert' : ''}${showBrandLevels ? ' portal-page-header--with-brands' : ''}`}>
      <div className="portal-hero-fx" aria-hidden="true">
        <span className="portal-hero-orb portal-hero-orb--a parallax" data-speed="0.08" />
        <span className="portal-hero-orb portal-hero-orb--b parallax" data-speed="0.16" />
      </div>
      <div className="container portal-header-container">
        {showSidePanel ? (
          <>
            <div className="portal-header-role-line">{roleBadge}</div>
            <PortalGreetingBlock
              greetingKey={t[greetingKey]}
              firstName={user.firstName}
              user={user}
              primaryRole={primaryRole}
              hideOrient={showBrandLevels}
            />
            {showBrandLevels && (
              <LearnerBrandLevelsStrip user={user} certGoals={resolvedGoals} />
            )}
            {showGeoBrands && (
            <div className="portal-header-geo-row portal-header-geo-row--grid">
                  <div className="portal-header-geo-brands">
                    {userBrands.map(brand => (
                      <BrandLogo key={brand} brand={brand} size="geo" />
                    ))}
                  </div>
            </div>
            )}
            {showCertCard && (
              <CertGoalCard goals={resolvedGoals} user={user} lms={lms} t={t} />
            )}
            {showKiCard && (
              <KiHeroCard user={user} lms={lms} />
            )}
            {(showTeamCard || showWorkshopCard) && (
              <TeamManagerHeroCard lms={lms} workshop={showWorkshopCard} />
            )}
          </>
        ) : (
          <div className="portal-header-main">
            <p className="page-header-eyebrow portal-header-eyebrow">
              {roleBadge}
            </p>
            <PortalGreetingBlock
              greetingKey={t[greetingKey]}
              firstName={user.firstName}
              user={user}
              primaryRole={primaryRole}
              hideOrient={showBrandLevels}
            />
            {showBrandLevels && (
              <LearnerBrandLevelsStrip user={user} certGoals={resolvedGoals} />
            )}
            {showGeoBrands && (
            <div className="portal-header-geo-row">
                  <div className="portal-header-geo-brands">
                    {userBrands.map(brand => (
                      <BrandLogo key={brand} brand={brand} size="geo" />
                    ))}
                  </div>
            </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
