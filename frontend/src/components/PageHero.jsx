import { Link } from 'react-router-dom'

export default function PageHero({ eyebrow, title, sub, ctas = [], chips = [] }) {
  return (
    <div className="page-hero">
      <div className="container">
        <div className="page-hero-content glass-panel">
          {eyebrow && <div className="page-hero-eyebrow">{eyebrow}</div>}
          <h1 className="page-hero-h1">{title}</h1>
          {sub && <p className="page-hero-sub">{sub}</p>}
          {chips.length > 0 && (
            <div className="page-hero-chips">
              {chips.map((c, i) => <span key={i} className="page-hero-chip">{c}</span>)}
            </div>
          )}
          {ctas.length > 0 && (
            <div className="page-hero-actions">
              {ctas.map((cta, i) =>
                cta.to ? (
                  <Link key={i} to={cta.to} className={`btn ${cta.primary ? 'btn-primary' : 'btn-ghost outline-light'}`}>
                    {cta.label} {cta.primary && <span className="arrow">→</span>}
                  </Link>
                ) : (
                  <button key={i} className={`btn ${cta.primary ? 'btn-primary' : 'btn-ghost outline-light'}`}>
                    {cta.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
      <div
        className="hero-scroll-indicator"
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        aria-hidden="true"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14"/>
          <path d="m19 12-7 7-7-7"/>
        </svg>
      </div>
    </div>
  )
}
