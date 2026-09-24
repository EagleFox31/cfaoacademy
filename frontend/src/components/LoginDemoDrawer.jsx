import { useEffect } from 'react'
import PvCard from './PvCard.jsx'
import useLocale from '../hooks/useLocale'
import { sortDemoProfiles } from '../utils/demoProfiles.js'

const DEMO_ROLE_LABELS = {
  learner: 'Apprenant',
  ki: 'KI — Formateur suppléant',
  team_manager: "Chef d'équipe",
  workshop_manager: "Chef d'atelier",
  branch_hr: 'RH Filiale',
  group_hr: 'RH Groupe',
  superadmin: 'Super Admin',
  build_team: 'Équipe build',
  group_admin: 'Admin Groupe (MOA)',
}

const DEMO_ROLE_LABELS_EN = {
  learner: 'Learner',
  ki: 'Key Instructor',
  team_manager: 'Team Manager',
  workshop_manager: 'Workshop Manager',
  branch_hr: 'Branch HR',
  group_hr: 'Group HR',
  superadmin: 'Super Admin',
  build_team: 'Build team',
  group_admin: 'Group Admin (MOA)',
}

const DEMO_IMG = '/assets/icone_technicien.png'

function roleLabel(role, locale) {
  const map = locale === 'en' ? DEMO_ROLE_LABELS_EN : DEMO_ROLE_LABELS
  return map[role] || role
}

export default function LoginDemoDrawer({
  profiles,
  open,
  onOpen,
  onClose,
  onSelectProfile,
}) {
  const { locale, t } = useLocale('login')
  const sortedProfiles = sortDemoProfiles(profiles)

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <>
      <button
        type="button"
        className="login-demo-toggle"
        onClick={onOpen}
        aria-expanded={open}
        aria-controls="login-demo-drawer"
      >
        <span className="login-demo-toggle-icon" aria-hidden="true">◇</span>
        <span className="login-demo-toggle-label">{t.demoDrawerToggle}</span>
      </button>

      <div
        className={`login-demo-backdrop${open ? ' is-visible' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        id="login-demo-drawer"
        className={`login-demo-drawer${open ? ' is-open' : ''}`}
        aria-label={t.demoDrawerTitle}
        aria-hidden={!open}
      >
        <div className="login-demo-drawer-head">
          <div>
            <p className="login-demo-drawer-eyebrow">{t.demoDrawerEyebrow}</p>
            <h2 className="login-demo-drawer-title">{t.demoDrawerTitle}</h2>
            <p className="login-demo-drawer-lead">{t.demoDrawerLead}</p>
          </div>
          <button
            type="button"
            className="login-demo-drawer-close"
            onClick={onClose}
            aria-label={t.demoDrawerClose}
          >
            ×
          </button>
        </div>

        <div className="login-demo-drawer-body">
          <div className="login-demo-profiles pv-grid pv-grid--stretch">
            {sortedProfiles.map(p => {
              const primaryRole = p.roles.find(r => DEMO_ROLE_LABELS[r]) || p.roles[0]
              const isMedacap = Boolean(p.medacapUsername || p.medacapUserId)
              return (
                <PvCard
                  key={p.id}
                  kicker={isMedacap ? 'MEDACAP · Cameroun' : roleLabel(primaryRole, locale)}
                  title={p.demoLabel ?? `${p.firstName} ${p.lastName}`}
                  meta={p.orgLabel || p.filiale}
                  img={DEMO_IMG}
                  accentColor="var(--red)"
                  cta={t.demoAccess}
                  corner
                  onClick={() => onSelectProfile(p.id)}
                  hoverHint={t.demoAccessHint}
                />
              )
            })}
          </div>
        </div>
      </aside>
    </>
  )
}
