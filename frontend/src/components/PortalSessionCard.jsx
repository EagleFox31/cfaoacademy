import { useEffect, useState } from 'react'
import SessionCard from './SessionCard.jsx'
import useAuth from '../hooks/useAuth.js'
import {
  isSessionRequested,
  toggleSessionRequest,
  sessionRequestKey,
  SESSION_REQUEST_EVENT,
} from '../utils/sessionRequests.js'

/** Carte session portail — même rendu que l'accueil + puce statut plan + bouton « Suggérer à mon Chef d'équipe ». */
export default function PortalSessionCard({
  session,
  annualStatus,
  t,
  accentColor,
  cta,
  hoverHint,
  statusOnImage = false,
  /** Plan pluri annuel : fiche PNG + pastille statut sur l'image (tous statuts). */
  planMode = false,
  showSessionDate = true,
  /** Autorise l'action « suggérer » (Situation 1 — avant tout test). */
  allowSuggest = false,
  user: userProp,
}) {
  const auth = useAuth()
  const user = userProp ?? auth?.user ?? null
  const reqKey = sessionRequestKey(session)

  const [requested, setRequested] = useState(() => isSessionRequested(user?.id, reqKey))

  useEffect(() => {
    setRequested(isSessionRequested(user?.id, reqKey))
    const onChange = (e) => {
      if (e.detail?.userId === user?.id && e.detail?.key === reqKey) {
        setRequested(e.detail.requested)
      }
    }
    window.addEventListener(SESSION_REQUEST_EVENT, onChange)
    return () => window.removeEventListener(SESSION_REQUEST_EVENT, onChange)
  }, [user?.id, reqKey])

  const baseStatus = annualStatus === 'todo' ? 'a_inscrire' : annualStatus
  const resolvedStatus = requested ? 'souhait_transmis' : baseStatus
  const statusKey = resolvedStatus ? `annual_${resolvedStatus}` : null

  const showStatusOnImage = planMode
    ? Boolean(statusKey)
    : (statusOnImage
        && (resolvedStatus === 'inscrit'
          || resolvedStatus === 'a_inscrire'
          || resolvedStatus === 'souhait_transmis'))

  const statusChip = statusKey ? (
    <span className={`portal-session-status-tag portal-status-chip ${statusKey}`}>
      {t?.[statusKey] ?? resolvedStatus}
    </span>
  ) : null

  const canSuggest = allowSuggest && user?.id && (baseStatus === 'a_inscrire' || requested)

  const handleToggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setRequested(toggleSessionRequest(user.id, reqKey, {
      code: session.code,
      title: session.nom ?? session.title,
      marque: session.marque,
      date: session.date,
    }))
  }

  const extraAction = canSuggest ? (
    <button
      type="button"
      className={`portal-interest-btn ${requested ? 'is-requested' : ''}`}
      onClick={handleToggle}
      title={requested ? (t?.interest_session_cancel ?? 'Cliquer pour annuler') : undefined}
    >
      <span aria-hidden="true">{requested ? '✓' : '★'}</span>
      <span>
        {requested
          ? (t?.interest_session_sent ?? 'Participation transmise')
          : (t?.interest_session ?? 'Je souhaite y participer')}
      </span>
    </button>
  ) : null

  return (
    <SessionCard
      session={session}
      kickerPrefix={statusChip}
      statusOnImage={showStatusOnImage}
      showSessionDate={showSessionDate}
      accentColor={requested ? '#059669' : accentColor}
      cta={cta}
      hoverHint={hoverHint}
      extraAction={extraAction}
    />
  )
}
