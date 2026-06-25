import { useEffect, useState } from 'react'
import { resolveCertGoalPrerequisites } from '../utils/certGoalProgress.js'

const BRAND_LOGOS = {
  toyota:     '/assets/logos/toyota.png',
  mercedes:   '/assets/logos/mercedes.png',
  suzuki:     '/assets/logos/suzuki.png',
  mitsubishi: '/assets/logos/mitsubishi.png',
  fuso:       '/assets/logos/fuso.png',
  hino:       '/assets/logos/hino.png',
  byd:        '/assets/logos/byd.png',
  citroen:    '/assets/logos/citroen.png',
  yamaha:     '/assets/logos/yamaha.png',
}

export default function PortalStickyBar({ user, lms, headerRef }) {
  const [visible, setVisible] = useState(false)

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

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  const brands = user.brands || []
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
      className={`portal-sticky-bar${visible ? ' portal-sticky-bar--visible' : ''}`}
      aria-hidden={!visible}
    >
      <div className="container portal-sticky-bar-inner">

        {brands.length > 0 && (
          <div className="portal-sticky-bar-brands">
            {brands.map(brand => {
              const src = BRAND_LOGOS[brand]
              return src ? (
                <img key={brand} src={src} alt={brand} className="portal-sticky-bar-brand-logo" />
              ) : (
                <span key={brand} className={`portal-brand-chip ${brand} portal-sticky-bar-brand-chip`}>
                  {brand}
                </span>
              )
            })}
          </div>
        )}

        {Object.keys(certLevels).length > 0 && (
          <div className="portal-sticky-bar-certs">
            {Object.entries(certLevels).map(([brand, level]) => (
              <span key={brand} className="portal-sticky-bar-cert-chip">
                {brand.charAt(0).toUpperCase() + brand.slice(1)} <strong>{level}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="portal-sticky-bar-progress">
          {goalLabel && <span className="portal-sticky-bar-goal">{goalLabel}</span>}
          <div className="portal-sticky-bar-track">
            <div className="portal-sticky-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="portal-sticky-bar-pct">{pct}%</span>
        </div>

      </div>
    </div>
  )
}
