/** Tracé du crayon « modifier », partagé par les cartes et les boutons des portails. */
export function IconeCrayon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * Crayon d'une carte de portail. Tant que l'édition n'existe pas, il reste en
 * pointillé et un clic ne déclenche pas le lien de la carte qui le contient.
 */
export default function PortalEditAction({ label }) {
  const bloquer = e => { e.preventDefault(); e.stopPropagation() }
  return (
    <span className="pv-card-action pv-card-action--soon" title={label} aria-label={label}
      role="img" onClick={bloquer}>
      <IconeCrayon />
    </span>
  )
}
