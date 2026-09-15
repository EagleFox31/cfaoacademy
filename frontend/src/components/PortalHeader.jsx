import { useState } from 'react'
import useLocale from '../hooks/useLocale'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import PortalRoleBadge from './PortalRoleBadge.jsx'
import LearnerBrandLevelsStrip from './LearnerBrandLevelsStrip.jsx'
import PortalGreetingBlock from './PortalGreetingBlock.jsx'
import TeamManagerHeroCard from './TeamManagerHeroCard.jsx'
import DpsFilialeBrandsStrip from './DpsFilialeBrandsStrip.jsx'
import PortalHeroShell from './PortalHeroShell.jsx'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'
import { formatCertLevelLabel } from '../utils/portalCertLevel.js'
import { computePortalGreetingKey } from '../utils/portalGreeting.js'

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

/* ─── Sub-components ────────────────────────────────────────────── */

function BrandLogo({ brand, size = 'default' }) {
  return <PortalBrandLogo brand={brand} size={size} />
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

export default function PortalHeader({ user, certGoals, certGoal, lms, workshop = false, filialeBrands }) {
  const { t } = useLocale('portal')
  const { t: heroT } = useLocale('hero')
  const { t: publicsT } = useLocale('publics')
  const [greetingKey] = useState(() => computePortalGreetingKey())
  const primaryRole = getPrimaryRole(user.roles)
  const userBrands = user.brands || []
  const baseRoleLabel = t[`role_${primaryRole}`] || primaryRole
  const roleLabel = primaryRole === 'learner'
    ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
    : baseRoleLabel
  const resolvedGoals = normalizeCertGoals({ certGoals, certGoal, user })
  const showCertCard = SHOW_LEARNER_CERT_CARD && primaryRole === 'learner' && resolvedGoals.length > 0
  const showBrandLevels = primaryRole === 'learner' && userBrands.length > 0
  const showDpsBrandsStrip = (primaryRole === 'dps' || primaryRole === 'dop') && (filialeBrands?.length > 0)
  const showTeamCard = primaryRole === 'team_manager' && lms
  const showWorkshopCard = primaryRole === 'workshop_manager' && lms
  const showSidePanel = showCertCard || showTeamCard || showWorkshopCard
  const showGeoBrands = !showBrandLevels && !showDpsBrandsStrip && userBrands.length > 0
  const showBrandsBand = showBrandLevels || showDpsBrandsStrip
  const dpsHero = showDpsBrandsStrip
    ? {
        technicianCount: lms?.kpis?.totalTechnicians,
        brandCount: filialeBrands?.length ?? 0,
      }
    : null
  const roleBadge = (
    <PortalRoleBadge role={primaryRole} label={roleLabel} />
  )

  const greetingBlock = (
    <PortalGreetingBlock
      greetingKey={t[greetingKey]}
      firstName={user.firstName}
      user={user}
      primaryRole={primaryRole}
      hideOrient={showBrandsBand}
      dpsHero={dpsHero}
    />
  )

  const brandsBand = (
    <>
      {showBrandLevels && (
        <LearnerBrandLevelsStrip user={user} certGoals={resolvedGoals} />
      )}
      {showDpsBrandsStrip && (
        <DpsFilialeBrandsStrip brandStats={filialeBrands} />
      )}
      {showGeoBrands && (
        <div className={`portal-header-geo-row${showBrandsBand ? ' portal-header-geo-row--grid portal-header-geo-row--below-brands' : ''}`}>
          <div className="portal-header-geo-brands">
            {userBrands.map(brand => (
              <BrandLogo key={brand} brand={brand} size="geo" />
            ))}
          </div>
        </div>
      )}
    </>
  )

  if (showSidePanel) {
    const aside = showCertCard
      ? <CertGoalCard goals={resolvedGoals} user={user} lms={lms} t={t} />
      : <TeamManagerHeroCard lms={lms} workshop={showWorkshopCard} />

    return (
      <PortalHeroShell aside={aside} className={showBrandsBand ? 'portal-page-header--with-brands' : ''}>
        <div className="portal-header-role-line">{roleBadge}</div>
        {greetingBlock}
        {brandsBand}
      </PortalHeroShell>
    )
  }

  return (
    <PortalHeroShell className={showBrandsBand ? 'portal-page-header--with-brands' : ''}>
      <div className="portal-header-main">
        <p className="page-header-eyebrow portal-header-eyebrow">{roleBadge}</p>
        {greetingBlock}
        {brandsBand}
      </div>
    </PortalHeroShell>
  )
}
