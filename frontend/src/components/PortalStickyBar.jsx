import { useEffect, useState } from 'react'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'
import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'
import useLocale from '../hooks/useLocale.js'

const BRAND_LOGOS = {
  toyota:          '/assets/logos/toyota.png',
  mercedes:        '/assets/logos/mercedes.png',
  'mercedes-benz': '/assets/logos/mercedes.png',
  suzuki:          '/assets/logos/suzuki.png',
  mitsubishi:      '/assets/logos/mitsubishi.png',
  fuso:            '/assets/logos/fuso.png',
  hino:            '/assets/logos/hino.png',
  byd:             '/assets/logos/byd.png',
  citroen:         '/assets/logos/citroen.png',
  yamaha:          '/assets/logos/yamaha.png',
  'renault-trucks':'/assets/logos/renault-trucks.png',
  sinotruk:        '/assets/logos/sinotruk.png',
  shacman:         '/assets/logos/shacman.png',
  'king-long':     '/assets/logos/kinglong.png',
  kinglong:        '/assets/logos/kinglong.png',
  bt:              '/assets/logos/bt.png',
  jcb:             '/assets/logos/jcb.png',
  lovol:           '/assets/logos/lovol.png',
}

function resolveBrandLogo(brand) {
  return BRAND_LOGOS[brand] ?? TEAM_BRAND_DEFS[brand]?.logo ?? null
}

export default function PortalStickyBar({ user, lms, headerRef, variant, filialeBrands }) {
  const [visible, setVisible] = useState(false)
  const isDps = variant === 'dps'
  const { t } = useLocale('portal')

  useEffect(() => {
    const el = headerRef?.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [headerRef])

  const brands = isDps
    ? (filialeBrands ?? []).map(row => row.brand)
    : (user.brands || [])
  const certLevels = user.certLevels || {}

  const goal = lms?.certGoals?.[0]
  const goalProgress = goal ? resolveCertGoalPrerequisites(user, lms, goal) : null
  const pct = goalProgress
    ? (goalProgress.total > 0
        ? Math.round((goalProgress.done / goalProgress.total) * 100)
        : 0)
    : (() => {
        const modules = lms?.modules ?? []
        const done = modules.filter(m => m.status === 'done').length
        return modules.length > 0 ? Math.round((done / modules.length) * 100) : 0
      })()

  const goalLabel = goal ? `${goal.currentLevel ?? '—'} → ${goal.targetLevel}` : null

  return (
    <div
      className={`portal-sticky-bar${visible ? ' portal-sticky-bar--visible' : ''}${isDps ? ' portal-sticky-bar--dps' : ''}`}
      aria-hidden={!visible}
    >
      <div className="container portal-sticky-bar-inner">

        {brands.length > 0 && (
          <div className="portal-sticky-bar-brands">
            {brands.map(brand => {
              const src = resolveBrandLogo(brand)
              const label = TEAM_BRAND_DEFS[brand]?.label ?? brand
              return src ? (
                <span key={brand} className="portal-sticky-bar-brand-tile" title={label}>
                  <img src={src} alt={label} className="portal-sticky-bar-brand-logo" />
                </span>
              ) : (
                <span key={brand} className={`portal-brand-chip ${brand} portal-sticky-bar-brand-chip`}>
                  {label}
                </span>
              )
            })}
          </div>
        )}

        {!isDps && Object.keys(certLevels).length > 0 && (
          <div className="portal-sticky-bar-certs">
            {Object.entries(certLevels).map(([brand, level]) => (
              <span key={brand} className="portal-sticky-bar-cert-chip">
                {brand.charAt(0).toUpperCase() + brand.slice(1)} <strong>{level}</strong>
              </span>
            ))}
          </div>
        )}

        {isDps && user.filiale ? (
          <div className="portal-sticky-bar-dps-meta">
            <span className="portal-sticky-bar-dps-label">{user.filiale}</span>
          </div>
        ) : null}

        {!isDps && (
          <div className="portal-sticky-bar-progress">
            {goalLabel && <span className="portal-sticky-bar-goal">{goalLabel}</span>}
            <div className="portal-sticky-bar-track">
              <div className="portal-sticky-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="portal-sticky-bar-pct">{pct}%</span>
          </div>
        )}

      </div>
    </div>
  )
}
