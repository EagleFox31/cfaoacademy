export function ElearningIcon({ size = 48, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 17v3" />
    </svg>
  )
}

/** Visuel icône pour les cartes e-learning du plan pluri annuel. */
export default function ElearningCardMedia({ statusChip }) {
  return (
    <div className="pv-card-img portal-elearning-card-img portal-session-card-img">
      <ElearningIcon />
      {statusChip && (
        <div className="portal-eval-img-tags">{statusChip}</div>
      )}
    </div>
  )
}
