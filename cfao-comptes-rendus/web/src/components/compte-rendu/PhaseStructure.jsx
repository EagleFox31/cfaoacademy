import { PARTIES_RAPPORT, partieRetenue } from '../../data/mock_sessions_formateur'
import Consigne from './Consigne'
import { estCertification } from '../../utils/certification'

// Une certification n'a ni test d'entree ni progression : ses resultats
// de groupe se limitent a la satisfaction, et ses fiches sont celles
// des candidats.
const RESUMES_CERTIFICATION = {
  resultats: 'Satisfaction des candidats',
  fiches: 'Une page par candidat : modules, e-learning, résultat final',
}

/**
 * Phase 3 — ce que le document contiendra.
 *
 * Le formateur compose son rapport. Seules la couverture et la cloture
 * sont imposees : elles encadrent le document et n'ont pas de contenu
 * a decider. Tout le reste se choisit, y compris ce que l'usage rend
 * habituel.
 *
 * Tout est coche par defaut : le formateur ne decide que s'il veut
 * retirer une partie. Les taux de presence dans les comptes rendus
 * existants, un temps affiches, ajoutaient de la lecture sans aider.
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
      return 'Aucune note saisie : ces pages seraient vides.'
    }
    if (id === 'objectifs' && !session?.codeFormation) {
      return 'À écrire vous-même : formation hors catalogue.'
    }
    if (id === 'deroule' && jours === 0) {
      return 'Dates inconnues : une seule page de journée.'
    }
    if (id === 'resultats' && synthese.saisis === 0) {
      return 'Aucune note saisie : cette page serait vide.'
    }
    return null
  }

  const retenues = PARTIES_RAPPORT.filter(p => estRetenue(p.id))
  const nbPages = estimerPages(retenues, brouillon, synthese, jours)

  return (
    <div className="cr-panel cr-panel--structure">
      <Consigne faire="Tout est déjà coché. Décochez seulement une partie que vous ne voulez pas."
        ensuite="Ensuite : compléter les pages, une par une." />

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
                  {p.obligatoire && <span className="cr-partie-etiq">Obligatoire</span>}
                </span>
                <span className="cr-partie-resume">
                  {(estCertification(brouillon) && RESUMES_CERTIFICATION[p.id]) || p.resume}
                </span>
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
          <strong>{nbPages}</strong> page{nbPages > 1 ? 's' : ''} dans le compte rendu
        </span>
        <span className="cr-structure-detail">
          {retenues.length} partie{retenues.length > 1 ? 's' : ''} cochée
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
