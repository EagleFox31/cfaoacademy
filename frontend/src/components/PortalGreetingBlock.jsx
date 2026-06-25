import { Fragment } from 'react'
import useLocale from '../hooks/useLocale'
import PortalFilialeFlag from './PortalFilialeFlag.jsx'
import { resolvePortalOrientKey } from '../utils/portalOrient.js'
import { resolveProfileFilialeLabel } from '../utils/profileOrg.js'

function splitWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean)
}

/** Salutation + phrase d'orientation du portail (selon le rôle actif). */
export default function PortalGreetingBlock({
  greetingKey,
  firstName,
  user,
  primaryRole,
  hideOrient = false,
}) {
  const { t, locale } = useLocale('portal')
  const orientKey = resolvePortalOrientKey(primaryRole)
  const orientText = !hideOrient && t[orientKey]
  const filialeLabel = user ? resolveProfileFilialeLabel(user) : null

  const greetingWords = splitWords(greetingKey)
  // Index de cascade partagé entre titre et sous-titre (apparition continue).
  let wi = 0
  const showPill = Boolean(filialeLabel && user)

  return (
    <div className="portal-header-greeting-block">
      <h1 className="page-header-title portal-header-greeting portal-greeting-cascade">
        {greetingWords.map((w, idx) => {
          const isLast = idx === greetingWords.length - 1
          const node = (
            <Fragment key={`g-${idx}`}>
              <span className="portal-word" style={{ '--wi': wi }}>
                {isLast ? `${w},` : w}
              </span>{' '}
            </Fragment>
          )
          wi += 1
          return node
        })}
        <span className="portal-word portal-header-firstname" style={{ '--wi': wi++ }}>
          {firstName}
        </span>{' '}
        <span className="portal-word" style={{ '--wi': wi++ }}>!</span>
        {showPill && (
          <span
            className="portal-header-greeting-org portal-word"
            style={{ '--wi': wi++ }}
          >
            <PortalFilialeFlag user={user} locale={locale} pill />
          </span>
        )}
      </h1>
      {orientText && (
        <p className="portal-header-orient portal-greeting-cascade">
          {splitWords(orientText).map((w, idx) => (
            <Fragment key={`o-${idx}`}>
              <span className="portal-word" style={{ '--wi': wi + idx }}>{w}</span>{' '}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
}
