export default function LandingSkeleton() {
  return (
    <div className="landing-skeleton" aria-busy="true" aria-label="Chargement de l'accueil...">
      {/* En-tête Hero */}
      <div className="landing-skeleton__hero">
        <div className="skeleton-shimmer landing-skeleton__hero-title" />
        <div className="skeleton-shimmer landing-skeleton__hero-meta" />
      </div>

      {/* Carte Consignes & Délais */}
      <div className="landing-skeleton__card">
        <div className="skeleton-shimmer landing-skeleton__card-header" />
        <div className="skeleton-shimmer landing-skeleton__card-line" />
        <div className="skeleton-shimmer landing-skeleton__card-line" />
        <div className="skeleton-shimmer landing-skeleton__card-line landing-skeleton__card-line--short" />
      </div>

      {/* Compteurs KPI */}
      <div className="landing-skeleton__counters">
        {[1, 2, 3].map((i) => (
          <div key={i} className="landing-skeleton__counter">
            <div className="skeleton-shimmer landing-skeleton__counter-icon" />
            <div className="landing-skeleton__counter-meta">
              <div className="skeleton-shimmer landing-skeleton__counter-label" />
              <div className="skeleton-shimmer landing-skeleton__counter-val" />
            </div>
          </div>
        ))}
      </div>

      {/* Rubrique / Pôles */}
      <div className="landing-skeleton__section-head">
        <div className="skeleton-shimmer landing-skeleton__section-title" />
        <div className="skeleton-shimmer landing-skeleton__section-sub" />
      </div>

      <div className="landing-skeleton__pole-grid">
        {[1, 2].map((p) => (
          <div key={p} className="landing-skeleton__pole-card">
            <div className="landing-skeleton__pole-head">
              <div className="skeleton-shimmer landing-skeleton__pole-icon" />
              <div className="skeleton-shimmer landing-skeleton__pole-title" />
            </div>
            <div className="landing-skeleton__brand-list">
              {[1, 2, 3, 4].map((b) => (
                <div key={b} className="landing-skeleton__brand-item">
                  <div className="skeleton-shimmer landing-skeleton__brand-logo" />
                  <div className="skeleton-shimmer landing-skeleton__brand-name" />
                  <div className="skeleton-shimmer landing-skeleton__brand-badge" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
