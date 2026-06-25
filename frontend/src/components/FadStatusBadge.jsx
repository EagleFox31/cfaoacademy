function FadStatusIcon({ statut }) {
  const svg = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (statut === 'planifie') {
    return (
      <svg {...svg}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    )
  }

  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

/** Pastille statut FAD — icône SVG + libellé (pas d’emoji). */
export default function FadStatusBadge({ statut, label, chip = false }) {
  const className = chip
    ? `portal-status-chip portal-fad-status-chip ${statut === 'planifie' ? 'progress' : 'todo'}`
    : `portal-fad-badge portal-fad-badge--icon ${statut}`

  return (
    <span className={className}>
      <FadStatusIcon statut={statut} />
      <span>{label}</span>
    </span>
  )
}
