/**
 * Icônes trait fin (SVG inline, `currentColor`) pour les faits d'une carte test.
 * 16×16, stroke 1.6 — pas d'emoji.
 */
const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconQuestions(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  )
}

export function IconDuration(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 3h6" />
    </svg>
  )
}

export function IconTarget(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  )
}

export function IconModality(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M7 9.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V9.5M21 7v5" />
    </svg>
  )
}
