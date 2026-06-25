import SessionCard from './SessionCard.jsx'

/** Carte session portail — même rendu que l'accueil (date, lieu, drapeau, formateur) + puce statut plan. */
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
}) {
  const resolvedStatus = annualStatus === 'todo'
    ? 'a_inscrire'
    : annualStatus
  const statusKey = resolvedStatus ? `annual_${resolvedStatus}` : null
  const showStatusOnImage = planMode
    ? Boolean(statusKey)
    : (statusOnImage && (resolvedStatus === 'inscrit' || resolvedStatus === 'a_inscrire'))
  const statusChip = statusKey ? (
    <span className={`portal-session-status-tag portal-status-chip ${statusKey}`}>
      {t[statusKey] ?? resolvedStatus}
    </span>
  ) : null

  return (
    <SessionCard
      session={session}
      kickerPrefix={statusChip}
      statusOnImage={showStatusOnImage}
      showSessionDate={showSessionDate}
      accentColor={accentColor}
      cta={cta}
      hoverHint={hoverHint}
    />
  )
}
