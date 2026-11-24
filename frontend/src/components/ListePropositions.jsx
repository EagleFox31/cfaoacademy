import { libelleType } from '../utils/typesProposition.js'
import { libelleEtape, statutDe } from '../utils/etapesProposition.js'

/**
 * Propositions de modification d'un compte et leur étape (Envoyée, Lue,
 * Planifiée, En ligne, Non retenue). Liste courte du panneau « Proposer une
 * modification » ; le suivi complet est sur la page « Mes propositions ».
 * `t` : namespace `portal`.
 */
export default function ListePropositions({ propositions = [], t, locale, max, className = '' }) {
  const dateDe = iso => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }
  const visibles = max ? propositions.slice(0, max) : propositions
  return (
    <ul className={`mes-propositions ${className}`.trim()}>
      {visibles.map(p => (
        <li key={p.id}>
          <span className="mes-propositions-quoi">
            <span className="mes-propositions-date">{dateDe(p.created_at)}</span>
            {' · '}
            {p.type ? libelleType(p.type, t) : (p.section || t.apercu_proposer_toute_page)}
            <span className="mes-propositions-message">{p.message}</span>
          </span>
          <span className={`mes-propositions-statut is-${statutDe(p)}`}>
            {libelleEtape(p, t, locale)}
          </span>
        </li>
      ))}
    </ul>
  )
}
