import { Link, useLocation, useNavigate } from 'react-router-dom'
import { splitRouterTo } from '../utils/routerTo.js'

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * Croix de fermeture (`.article-close`). Lien si `to` est défini, sinon retour historique.
 */
export default function PageCloseButton({
  to,
  onClick,
  ariaLabel,
  className = '',
  fallbackTo = '/',
}) {
  const classes = ['article-close', className].filter(Boolean).join(' ')

  if (to != null) {
    const { to: linkTo, state: linkState } = splitRouterTo(to)
    return (
      <Link to={linkTo} state={linkState} className={classes} aria-label={ariaLabel}>
        <CloseIcon />
      </Link>
    )
  }

  return (
    <PageCloseBackButton
      onClick={onClick}
      ariaLabel={ariaLabel}
      className={className}
      fallbackTo={fallbackTo}
    />
  )
}

function PageCloseBackButton({ onClick, ariaLabel, className, fallbackTo }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = onClick ?? (() => {
    if (location.key !== 'default') navigate(-1)
    else navigate(fallbackTo)
  })

  const classes = ['article-close', className].filter(Boolean).join(' ')

  return (
    <button type="button" className={classes} onClick={handleClick} aria-label={ariaLabel}>
      <CloseIcon />
    </button>
  )
}
