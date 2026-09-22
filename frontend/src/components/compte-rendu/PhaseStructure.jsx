import { PARTIES_RAPPORT, partieRetenue } from '../../data/mock_sessions_formateur'

/**
 * Phase 3 — ce que le document contiendra.
 *
 * Le formateur compose son rapport. Seules la couverture et la cloture
 * sont imposees : elles encadrent le document et n'ont pas de contenu
 * a decider. Tout le reste se choisit, y compris ce que l'usage rend
 * habituel.
 *
 * Le taux affiche a cote de chaque partie vient de l'analyse des
 * quatorze comptes rendus existants. Il informe sans contraindre :
 * savoir que le deroule journalier figure dans 92 % des rapports aide
 * a decider, mais la session peut justifier de s'en passer.
 *
 * Une partie sans matiere est signalee comme telle plutot que cochee
 * d'office : proposer « Fiches individuelles » quand aucune note n'est
 * saisie produirait des pages vides.
 */
export default function PhaseStructure({ brouillon, maj, session, synthese }) {
  const choix = brouillon.parties || {}
  const jours = brouillon.nbJours || 0

  function basculer(id) {
    maj({ parties: { ...choix, [id]: !estRetenue(id) } })
  }

  const estRetenue = id => partieRetenue(choix, id)

  /** Ce qui manque pour qu'une partie ait du contenu, le cas echeant. */
  function manque(id) {
    if (id === 'fiches' && synthese.saisis === 0) {
      return 'Aucune note saisie : les fiches seraient vides.'
    }
    if (id === 'objectifs' && !session?.codeFormation) {
      return 'Formation hors catalogue : à saisir vous-même.'
    }
    if (id === 'deroule' && jours === 0) {
      return 'Durée inconnue : une seule page sera produite.'
    }
    if (id === 'resultats' && synthese.saisis === 0) {
      return 'Aucun résultat saisi.'
    }
    return null
  }

  const retenues = PARTIES_RAPPORT.filter(p => estRetenue(p.id))
  const nbPages = estimerPages(retenues, brouillon, synthese, jours)

  return (
    <div className="cr-panel cr-panel--structure">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Que contiendra le document ?</h2>
        <p className="cr-panel-hint">
          Décochez ce que cette session ne justifie pas. Le pourcentage
          rappelle la fréquence de chaque partie dans les comptes rendus
          existants.
        </p>
      </div>

      <div className="cr-parties">
        {PARTIES_RAPPORT.map(p => {
          const retenue = estRetenue(p.id)
          const alerte = manque(p.id)
          return (
            <label key={p.id}
              className={`cr-partie${retenue ? ' cr-partie--on' : ''}`
                + `${p.obligatoire ? ' cr-partie--fixe' : ''}`}>
              <input type="checkbox" className="cr-partie-case"
                checked={retenue}
                disabled={p.obligatoire}
                onChange={() => basculer(p.id)}
                aria-label={p.titre} />
              <span className="cr-partie-numero" aria-hidden="true">
                {p.numero}
              </span>
              <span className="cr-partie-corps">
                <span className="cr-partie-tete">
                  <span className="cr-partie-titre">{p.titre}</span>
                  {p.obligatoire
                    ? <span className="cr-partie-etiq">Toujours incluse</span>
                    : <span className="cr-partie-freq">{p.presence} % des rapports</span>}
                </span>
                <span className="cr-partie-resume">{p.resume}</span>
                {alerte && <span className="cr-partie-alerte">{alerte}</span>}
              </span>
            </label>
          )
        })}
      </div>

      {/* Le bilan du document reste au pied du panneau : c'est la
          conclusion de ce qu'on vient de composer, pas une carte de
          plus dans la grille. */}
      <div className="cr-structure-pied">
        <span className="cr-structure-compte">
          <strong>{nbPages}</strong> page{nbPages > 1 ? 's' : ''} au total
        </span>
        <span className="cr-structure-detail">
          {retenues.length} partie{retenues.length > 1 ? 's' : ''} retenue
          {retenues.length > 1 ? 's' : ''} sur {PARTIES_RAPPORT.length}
        </span>
      </div>
    </div>
  )
}

/** Nombre de pages produites : certaines parties en valent plusieurs. */
function estimerPages(retenues, brouillon, synthese, jours) {
  const presents = (brouillon.participants || [])
    .filter(p => p.present !== false).length
  return retenues.reduce((total, p) => {
    if (p.id === 'deroule') return total + Math.max(jours, 1)
    if (p.id === 'fiches') return total + presents
    return total + 1
  }, 0)
}
