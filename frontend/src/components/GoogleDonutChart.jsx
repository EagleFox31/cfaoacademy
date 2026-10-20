import { useState, useId } from 'react'

/**
 * Donut chart interactif style Google (Material / Google Analytics)
 * - Bleu pour fait (#1a73e8 / #1a56db)
 * - Gris clair pour pas fait (#eaedf2)
 * - Taux en pourcentage écrit en dessous
 * - Infobulle interactive au survol
 */
export default function GoogleDonutChart({
  pct = 0,
  label = 'Taux de couverture des tests',
  size = 88,
  radius = 35,
  strokeWidth = 16,
  doneColor = '#1a73e8',
  trackColor = '#eaedf2',
  detailHint,
  todoHint,
  className = '',
}) {
  const [hovered, setHovered] = useState(false)
  const [hoveredSegment, setHoveredSegment] = useState(null) // 'done' | 'todo' | null
  const tooltipId = useId()

  const clampedPct = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)))
  const remainingPct = 100 - clampedPct
  const isComplete = clampedPct >= 100

  // Géométrie SVG avec remplissage épais (thick ring Google)
  const circumference = 2 * Math.PI * radius // ~219.9
  const strokeDashoffset = circumference - (circumference * clampedPct) / 100

  const activeColor = isComplete ? '#1a56db' : doneColor

  return (
    <div
      className={`portal-google-donut-container ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setHoveredSegment(null)
      }}
      tabIndex="0"
      role="img"
      aria-label={`${label} : ${clampedPct}%`}
      aria-describedby={tooltipId}
    >
      {/* Anneau SVG façon Google */}
      <div className="portal-google-donut-svg-wrap">
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`portal-google-donut-svg ${hovered ? 'is-hovered' : ''}`}
        >
          {/* Segment "Pas fait" (Gris clair) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={hoveredSegment === 'todo' ? strokeWidth + 2 : strokeWidth}
            className="portal-google-donut-track"
            onMouseEnter={() => setHoveredSegment('todo')}
            onMouseLeave={() => setHoveredSegment(null)}
          />

          {/* Segment "Fait" (Bleu Google / CFAO) */}
          {clampedPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={activeColor}
              strokeWidth={hoveredSegment === 'done' || (hovered && !hoveredSegment) ? strokeWidth + 2 : strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap={clampedPct >= 100 ? 'butt' : 'round'}
              transform="rotate(-90 50 50)"
              className="portal-google-donut-fill"
              onMouseEnter={() => setHoveredSegment('done')}
              onMouseLeave={() => setHoveredSegment(null)}
            />
          )}

          {/* Cœur du donut : coche subtile si 100% complété */}
          {isComplete ? (
            <path
              d="M41 51 l6 6 l13 -13"
              fill="none"
              stroke={activeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="portal-google-donut-check"
            />
          ) : null}
        </svg>

        {/* Infobulle interactive flottante au survol */}
        {hovered && (
          <div id={tooltipId} className="portal-google-donut-tooltip" role="tooltip">
            {hoveredSegment === 'todo' ? (
              <>
                <span className="tooltip-dot todo" />
                <span>Restant : <strong>{remainingPct}%</strong></span>
                {todoHint && <span className="tooltip-sub">({todoHint})</span>}
              </>
            ) : (
              <>
                <span className="tooltip-dot done" />
                <span>Réalisé : <strong>{clampedPct}%</strong></span>
                {detailHint && <span className="tooltip-sub">({detailHint})</span>}
              </>
            )}
          </div>
        )}
      </div>

      {/* Taux en pourcentage et libellé écrits EN DESSOUS */}
      <div className="portal-google-donut-under">
        <div className="portal-google-donut-pct-line">
          <span className="portal-google-donut-big-pct">{clampedPct}%</span>
          {isComplete && <span className="portal-google-donut-badge-done">COMPLET</span>}
        </div>
        {label && <div className="portal-google-donut-label-text">{label}</div>}
      </div>
    </div>
  )
}
