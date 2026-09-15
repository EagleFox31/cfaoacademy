/**
 * Icônes partagées entre l'accueil et la grille de saisie.
 *
 * Elles vivaient dans `Poles.jsx` ; la grille marque affiche les mêmes compteurs
 * et les mêmes titres de rubrique, d'où l'extraction plutôt qu'un second jeu de
 * `<svg>` qui aurait dérivé au premier ajustement de trait.
 */
const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function IconInfo() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function IconTag() {
  return (
    <svg {...ICON}>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

export function IconUsers() {
  return (
    <svg {...ICON}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconBook() {
  return (
    <svg {...ICON}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export function IconWrench() {
  return (
    <svg {...ICON}>
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-8.4 8.4a2.8 2.8 0 0 1-4-4z" />
      <path d="M19.7 11.3 21 10a5 5 0 0 0-7-7l-1.3 1.3" />
    </svg>
  )
}

export function IconArrowLeft() {
  return (
    <svg {...ICON}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export function IconBodywork() {
  return (
    <svg {...ICON}>
      <path d="M3 11h4l2-4h6l2 4h4v6h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" />
      <path d="M7 11h10" />
    </svg>
  )
}
