/** Icône technicien (SVG) — bandeau média cartes alerte. */
export default function TechnicianMediaIcon({ alert = false }) {
  const svg = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  return (
    <span className={`portal-team-member-tech-icon${alert ? ' is-alert' : ''}`}>
      <svg {...svg}>
        <circle cx="12" cy="7" r="3" />
        <path d="M6 21v-1.5a3.5 3.5 0 0 1 3.5-3.5h1" />
        <path d="M14.5 16H18l1.5 3h-4.5" />
        <path d="M17.5 13.5V16" />
        <path d="M16 13.5h3" />
      </svg>
    </span>
  )
}
