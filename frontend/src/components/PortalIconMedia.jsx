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
  // Tableau de présentation : un formateur et ses sessions.
  formateur: (
    <>
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </>
  ),
  // Fenêtres côte à côte : les portails des profils.
  portails: (
    <>
      <rect x="2" y="3" width="9" height="8" rx="1.5" />
      <rect x="13" y="3" width="9" height="8" rx="1.5" />
      <rect x="2" y="13" width="9" height="8" rx="1.5" />
      <rect x="13" y="13" width="9" height="8" rx="1.5" />
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
  // Livre ouvert : le catalogue des offres de formation.
  offres: (
    <>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </>
  ),
  // Calendrier : la grille des formateurs de l'année.
  calendrier: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M7 14h4" />
      <path d="M13 18h4" />
    </>
  ),
  // Étiquette de prix : les tarifs.
  tarif: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
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
