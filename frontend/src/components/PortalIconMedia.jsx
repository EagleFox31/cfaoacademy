/**
 * Visuel sobre d'une carte de suivi : une icône métier sur un fond teinté de
 * la couleur du statut. À passer dans la prop `cardMedia` d'une PvCard quand
 * une photo n'apprendrait rien (cartes annuelles qui ne diffèrent que par
 * l'année, le statut et les chiffres).
 */
const ICONES = {
  // Reçu ligné : le devis d'une filiale.
  devis: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M14 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
    </>
  ),
  // Triangle d'alerte : des points à traiter.
  alerte: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // Liste à cocher : le recueil des besoins.
  besoins: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
}

/** `tone` reprend les statuts des pastilles : done, progress, open, closed, todo. */
export default function PortalIconMedia({ icon, tone = 'todo' }) {
  return (
    <div className={`pv-card-img portal-icon-media portal-icon-media--${tone}`} aria-hidden="true">
      <span className="portal-icon-media__disc">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONES[icon]}
        </svg>
      </span>
    </div>
  )
}
