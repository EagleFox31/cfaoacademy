import { useEffect } from 'react'
import PvCard from './PvCard.jsx'
import useLocale from '../hooks/useLocale'
import { demoProfileKicker, sortDemoProfiles } from '../utils/demoProfiles.js'
import { resolveProfileIcon } from '../utils/resolveProfileIcon.js'

const USERNAME_BY_DEMO_KEY = {
  u1: 'kouame.assi',
  u2: 'brahim.tahir',
  u3: 'seydou.diallo',
  u4: 'fatou.mbaye',
  u5: 'aminata.kone',
  u6: 'admin.groupe',
  u7: 'tech.lead',
  u8: 'moa.pilotage',
  u9: 'loic.traore',
  u10: 'jacques.robin',
  u11: 'andre.yogba',
}

export default function LoginDemoDrawer({
  profiles,
  open,
  onOpen,
  onClose,
  onSelectProfile,
}) {
  const { t } = useLocale('login')
  const { t: portalT } = useLocale('portal')
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
        onClick={open ? onClose : onOpen}
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
            {sortedProfiles.map((p) => {
              const username = USERNAME_BY_DEMO_KEY[p.id] || p.email
              const metaText = `${p.orgLabel || p.filiale} · Login : ${username} (mdp: demo)`
              return (
                <PvCard
                  key={p.id}
                  kicker={demoProfileKicker(p, portalT)}
                  title={p.demoLabel ?? `${p.firstName} ${p.lastName}`}
                  meta={metaText}
                  img={resolveProfileIcon(p, { fallbackTech: true })}
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
