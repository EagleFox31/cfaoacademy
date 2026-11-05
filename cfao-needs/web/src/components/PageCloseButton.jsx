/**
 * Croix de fermeture — même geste que la vitrine (`PageCloseButton` / `.article-close`).
 *
 * Lien si `to` est fourni ; sinon bouton (`onClick` ou historique).
 */
import { Link } from 'react-router-dom'

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export default function PageCloseButton({
  to,
  onClick,
  ariaLabel,
  className = '',
}) {
  const classes = ['page-close', className].filter(Boolean).join(' ')

  if (to != null && !onClick) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        <CloseIcon />
      </Link>
    )
  }

  return (
    <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel}>
      <CloseIcon />
    </button>
  )
}
