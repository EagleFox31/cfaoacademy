import { useState } from 'react'
import useLocale from '../hooks/useLocale'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import PortalRoleBadge from './PortalRoleBadge.jsx'
import LearnerBrandLevelsStrip from './LearnerBrandLevelsStrip.jsx'
import PortalGreetingBlock from './PortalGreetingBlock.jsx'
import TeamManagerHeroCard from './TeamManagerHeroCard.jsx'
import DpsFilialeBrandsStrip from './DpsFilialeBrandsStrip.jsx'
import SuperAdminBuBrandsStrip from './SuperAdminBuBrandsStrip.jsx'
import PortalHeroShell from './PortalHeroShell.jsx'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'
import { formatCertLevelLabel } from '../utils/portalCertLevel.js'
import { isPlMedacapVariant } from '../utils/portalVariant.js'
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
  training_coordinator: 'Coordinateur formations',
  center_assistant: 'Assistante Centre de formation',
}

const ROLE_PRIORITY = [
  'superadmin','branch_hr','branch_admin','group_hr','group_admin',
  'workshop_manager','team_manager','ki','pic',
  'trainer','center_director','training_coordinator','center_assistant','dop','dps','branch_director',
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

export default function PortalHeader({
  user,
  certGoals,
  certGoal,
  lms,
  workshop = false,
  filialeBrands,
  activeBu: controlledActiveBu,
  onBuChange,
  managerHeroCard,
  centerHero,
}) {
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
  const [internalActiveBu, setInternalActiveBu] = useState('all')
  const activeBu = controlledActiveBu !== undefined ? controlledActiveBu : internalActiveBu
  const setActiveBu = onBuChange || setInternalActiveBu
  const isSuperAdmin = primaryRole === 'superadmin'
  const resolvedGoals = normalizeCertGoals({ certGoals, certGoal, user })
  const showCertCard = SHOW_LEARNER_CERT_CARD && primaryRole === 'learner' && resolvedGoals.length > 0
  const showBrandLevels = primaryRole === 'learner' && userBrands.length > 0
  const isManager = primaryRole === 'team_manager' || primaryRole === 'workshop_manager'
  const showDpsBrandsStrip = (primaryRole === 'dps' || primaryRole === 'dop' || isManager) && (filialeBrands?.length > 0)
  const showSuperAdminBrands = isSuperAdmin
  // Card aside retirée : les managers ont désormais le strip marques sous le hero (norme DPS).
  const showTeamCard = false
  const showWorkshopCard = false
  const showSidePanel = showCertCard || showTeamCard || showWorkshopCard
  const [superadminStripMode, setSuperadminStripMode] = useState('marques')

  const showGeoBrands = !showBrandLevels && !showDpsBrandsStrip && !showSuperAdminBrands && userBrands.length > 0
  const showBrandsBand = showBrandLevels || showDpsBrandsStrip || showSuperAdminBrands
  // Entête compacte (variante PL-MEDACAP) : mêmes informations, densité plus
  // forte, pour que la première section tienne dans l'écran sans défilement.
  const heroClassName = [showBrandsBand && 'portal-page-header--with-brands', isPlMedacapVariant(lms) && 'portal-page-header--compact']
    .filter(Boolean).join(' ')
  const dpsHero = (showDpsBrandsStrip && !isManager)
    ? {
        technicianCount: lms?.technicians?.length || lms?.kpis?.totalTechnicians,
        brandCount: filialeBrands?.length ?? 0,
      }
    : null
  // Toutes les valeurs viennent de l'API bu-scoped (via useSuperadminGroupStats).
  // Le hook re-fetch automatiquement quand `activeBu` change côté SuperAdminDashboard,
  // ce qui hydrate `lms.globalKpis` avec les compteurs du bon périmètre.
  const superadminHero = isSuperAdmin && lms?.globalKpis
    ? {
        learnerCount:  lms.globalKpis.totalApprenants,
        branchCount:   lms.globalKpis.filialesActives,
        brandCount:    lms.globalKpis.brandsCount,
        trainingCount: lms.globalKpis.sessionsActives,
        trainingYear:  lms.globalKpis.trainingYear,
        stripMode:     superadminStripMode,
        onToggleStripMode: setSuperadminStripMode,
      }
    : null
  // Hero phrase chef d'équipe : nourri par lms.managerScope (hook useManagerScope).
  const managerHero = isManager && lms?.managerScope
    ? {
        technicianCount: lms.managerScope.technicianCount,
        brandCount:      lms.managerScope.brandCount,
        loading:         lms.managerScope.loading ?? false,
      }
    : null

  const roleBadge = isSuperAdmin ? (
    <div className="portal-header-role-row">
      <PortalRoleBadge role={primaryRole} label={roleLabel} />
      <div className="portal-header-bu-switcher" role="tablist" aria-label="Business Units">
        <button
          type="button"
          role="tab"
          id="bu-tab-all"
          aria-selected={activeBu === 'all'}
          className={`portal-header-bu-badge ${activeBu === 'all' ? 'is-active is-all' : ''}`}
          onClick={() => setActiveBu('all')}
          title="Toutes les Business Units (Equipment & Motors - 20 marques)"
        >
          <span className="portal-header-bu-badge-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          <span>Toutes BU</span>
          <span className="portal-header-bu-badge-count">20</span>
        </button>
        <button
          type="button"
          role="tab"
          id="bu-tab-equipment"
          aria-selected={activeBu === 'equipment'}
          className={`portal-header-bu-badge ${activeBu === 'equipment' ? 'is-active is-equipment' : ''}`}
          onClick={() => setActiveBu(activeBu === 'equipment' ? 'all' : 'equipment')}
          title="Pôle Equipment (BTP, Poids Lourds, Manutention - 11 marques)"
        >
          <span className="portal-header-bu-badge-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          <span>Equipment</span>
          <span className="portal-header-bu-badge-count">11</span>
        </button>
        <button
          type="button"
          role="tab"
          id="bu-tab-motors"
          aria-selected={activeBu === 'motors'}
          className={`portal-header-bu-badge ${activeBu === 'motors' ? 'is-active is-motors' : ''}`}
          onClick={() => setActiveBu(activeBu === 'motors' ? 'all' : 'motors')}
          title="Pôle Motors (Véhicules particuliers & utilitaires - 9 marques)"
        >
          <span className="portal-header-bu-badge-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <path d="M9 17h6" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </span>
          <span>Motors</span>
          <span className="portal-header-bu-badge-count">9</span>
        </button>
      </div>
    </div>
  ) : (
    <PortalRoleBadge role={primaryRole} label={roleLabel} />
  )

  const greetingBlock = (
    <PortalGreetingBlock
      greetingKey={t[greetingKey]}
      firstName={user.firstName}
      user={user}
      primaryRole={primaryRole}
      hideOrient={showBrandLevels || showDpsBrandsStrip || isSuperAdmin || isManager || Boolean(centerHero)}
      dpsHero={dpsHero}
      superadminHero={superadminHero}
      managerHero={managerHero}
      centerHero={centerHero}
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
      {showSuperAdminBrands && (
        <SuperAdminBuBrandsStrip
          activeBu={activeBu}
          mode={superadminStripMode}
          filiales={lms?.filialesLearners}
        />
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

  if (managerHeroCard || showSidePanel) {
    const aside = managerHeroCard
      || (showCertCard
        ? <CertGoalCard goals={resolvedGoals} user={user} lms={lms} t={t} />
        : <TeamManagerHeroCard lms={lms} workshop={showWorkshopCard} />)

    return (
      <PortalHeroShell aside={aside} className={heroClassName}>
        <div className="portal-header-role-line">{roleBadge}</div>
        {greetingBlock}
        {brandsBand}
      </PortalHeroShell>
    )
  }

  return (
    <PortalHeroShell className={heroClassName}>
      <div className="portal-header-main">
        <div className="page-header-eyebrow portal-header-eyebrow">{roleBadge}</div>
        {greetingBlock}
        {brandsBand}
      </div>
    </PortalHeroShell>
  )
}
