import { Link } from 'react-router-dom'
import PortalReveal from './PortalReveal.jsx'

const ASSISTANCE_POINTS = [
  'assistance_point_1',
  'assistance_point_2',
  'assistance_point_3',
]

export default function PortalAssistanceSection({ t, variant = 'learner' }) {
  const desc = variant === 'manager' ? t.tm_assistance_desc : t.assistance_desc

  return (
    <PortalReveal id="assistance" className="portal-assistance-section">
      <div className="container" style={{ padding: '48px 32px' }}>
        <div className="portal-assistance-panel">
          <div className="portal-assistance-panel-main">
            <p className="portal-assistance-eyebrow">{t.eyebrow_assistance}</p>
            <h2 className="portal-assistance-title">{t.title_assistance}</h2>
            <p className="portal-assistance-desc">{desc}</p>
            {variant === 'learner' && (
              <ul className="portal-assistance-points">
                {ASSISTANCE_POINTS.map(key => (
                  <li key={key}>{t[key]}</li>
                ))}
              </ul>
            )}
            <p className="portal-assistance-note">{t.assistance_note}</p>
          </div>
          <div className="portal-assistance-panel-aside">
            <Link to="/portail/assistance" className="portal-assistance-cta">
              {t.assistance_cta}
              <span className="portal-assistance-cta-arrow" aria-hidden="true">→</span>
            </Link>
            <p className="portal-assistance-cta-hint">{t.assistance_cta_hint}</p>
          </div>
        </div>
      </div>
    </PortalReveal>
  )
}
