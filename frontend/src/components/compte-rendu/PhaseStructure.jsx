import { PARTIES_RAPPORT } from '../../data/mock_sessions_formateur'

/**
 * Phase 3 — ce que le document contiendra.
 *
 * Les neuf parties ne sont pas toutes de meme nature. L'analyse des
 * quatorze comptes rendus existants donne leur frequence : couverture
 * 100 %, participants 92 %, deroule 92 %, resultats 92 %, bilan 92 %,
 * puis objectifs et fiches individuelles 78 %, qualite 64 %, cloture
 * 21 %. Au-dela de 90 % la partie est traitee comme acquise : on la
 * montre sans la proposer au retrait, pour ne pas laisser produire un
 * rapport que personne ne reconnaitrait. En deca, le formateur tranche.
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

  function estRetenue(id) {
    const partie = PARTIES_RAPPORT.find(p => p.id === id)
    if (partie?.obligatoire) return true
    return choix[id] ?? defautPour(id)
  }

  /** Une partie optionnelle n'est proposee cochee que si elle a de quoi
   *  se remplir. */
  function defautPour(id) {
    if (id === 'fiches') return synthese.saisis > 0
    if (id === 'objectifs') return Boolean(session?.codeFormation)
    if (id === 'qualite') return false
    if (id === 'cloture') return false
    return true
  }

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
    return null
  }

  const retenues = PARTIES_RAPPORT.filter(p => estRetenue(p.id))
  const nbPages = estimerPages(retenues, brouillon, synthese, jours)

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Que contiendra le document ?</h2>
        <p className="cr-panel-hint">
          Les parties attendues dans tous les comptes rendus sont déjà
          retenues. Ajoutez ou retirez les autres selon la session.
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
