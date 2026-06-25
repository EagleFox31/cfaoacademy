import { Link } from 'react-router-dom'
import { splitRouterTo } from '../utils/routerTo.js'

function NotFoundIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 13.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 17h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16.25" cy="16.25" r="4.25" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
      <path d="m18.4 14.1 1.9 1.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Panneau éditorial « contenu introuvable » — fiche, article, public…
 */
export default function ContentNotFound({
  eyebrow,
  title,
  lead,
  primaryTo,
  primaryLabel,
  primaryBack = false,
  primaryOnClick,
  secondaryTo,
  secondaryLabel,
}) {
  return (
    <div className="content-not-found" role="status">
      <div className="content-not-found-sheet">
        <div className="content-not-found-icon" aria-hidden="true">
          <NotFoundIcon />
        </div>

        {eyebrow && <p className="content-not-found-eyebrow">{eyebrow}</p>}
        <h1 className="content-not-found-title">{title}</h1>
        {lead && <p className="content-not-found-lead">{lead}</p>}

        {(primaryTo || primaryOnClick || secondaryTo) && (
          <div className="content-not-found-actions">
            {primaryLabel && (primaryOnClick || primaryTo) && (() => {
              if (primaryOnClick) {
                return (
                  <button
                    type="button"
                    onClick={primaryOnClick}
                    className={`btn btn-primary${primaryBack ? ' btn--back' : ''}`}
                  >
                    {primaryBack && <span className="arrow" aria-hidden="true">←</span>}
                    {primaryLabel}
                    {!primaryBack && <span className="arrow" aria-hidden="true">→</span>}
                  </button>
                )
              }
              const { to: linkTo, state: linkState } = splitRouterTo(primaryTo)
              return (
                <Link
                  to={linkTo}
                  state={linkState}
                  className={`btn btn-primary${primaryBack ? ' btn--back' : ''}`}
                >
                  {primaryBack && <span className="arrow" aria-hidden="true">←</span>}
                  {primaryLabel}
                  {!primaryBack && <span className="arrow" aria-hidden="true">→</span>}
                </Link>
              )
            })()}
            {secondaryTo && secondaryLabel && (() => {
              const { to: linkTo, state: linkState } = splitRouterTo(secondaryTo)
              return (
                <Link to={linkTo} state={linkState} className="btn btn-ghost">
                  {secondaryLabel}
                </Link>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
