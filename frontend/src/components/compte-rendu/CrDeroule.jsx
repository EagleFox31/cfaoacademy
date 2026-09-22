import { useState } from 'react'
import { joursDeSession, dateLongue } from '../../utils/compteRendu'

/**
 * Le deroule journalier : une page par jour de formation.
 *
 * Trois rubriques par jour, reprises des comptes rendus existants :
 * thematiques abordees, points forts, points d'amelioration. Chacune est
 * une liste ouverte — un jour peut avoir deux thematiques, un autre six.
 *
 * Le jour precedent sert de modele au suivant : beaucoup de rubriques se
 * repetent d'un jour a l'autre (« salle conforme », « groupe engage »),
 * et les resaisir six fois decourage. Le bouton copie, il ne fusionne
 * pas : le formateur garde la main sur ce qu'il conserve.
 */
const RUBRIQUES = [
  { cle: 'thematiques', titre: 'Thématiques abordées', exemple: 'Rappel théorique sur le système étudié' },
  { cle: 'forts', titre: 'Points forts', exemple: 'Groupe engagé, bonne maîtrise des outils' },
  { cle: 'ameliorations', titre: 'Points d’amélioration', exemple: 'Prérequis e-learning à terminer en amont' },
]

export default function CrDeroule({ brouillon, maj, session }) {
  const jours = joursDeSession(session)
  const [actif, setActif] = useState(1)
  const donnees = brouillon.jours || {}
  const courant = donnees[actif] || { thematiques: [''], forts: [''], ameliorations: [''] }

  function majJour(patch) {
    maj({ jours: { ...donnees, [actif]: { ...courant, ...patch } } })
  }

  function modifierLigne(rubrique, i, valeur) {
    const liste = [...(courant[rubrique] || [''])]
    liste[i] = valeur
    majJour({ [rubrique]: liste })
  }

  function ajouterLigne(rubrique) {
    majJour({ [rubrique]: [...(courant[rubrique] || []), ''] })
  }

  function retirerLigne(rubrique, i) {
    const liste = (courant[rubrique] || []).filter((_, j) => j !== i)
    majJour({ [rubrique]: liste.length ? liste : [''] })
  }

  function copierVeille() {
    const veille = donnees[actif - 1]
    if (veille) maj({ jours: { ...donnees, [actif]: { ...veille } } })
  }

  function rempli(n) {
    const j = donnees[n]
    return j && (j.thematiques || []).some(t => t && t.trim())
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Comment s’est passée chaque journée ?</h2>
        <p className="cr-panel-hint">
          Une page du rapport par jour. Notez ce qui a été abordé, ce qui a bien
          fonctionné et ce qui reste à améliorer.
        </p>
      </div>

      <div className="cr-days">
        {jours.map(j => (
          <button
            key={j.index}
            type="button"
            className={`cr-day${actif === j.index ? ' cr-day--on' : ''}`}
            onClick={() => setActif(j.index)}
          >
            Jour {j.index}
            {rempli(j.index) && <span className="cr-day-mark" aria-label="rempli">✓</span>}
          </button>
        ))}
      </div>

      {jours[actif - 1]?.date && (
        <p style={{
          fontSize: 13, color: 'var(--muted)', margin: '-8px 0 18px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
          {dateLongue(jours[actif - 1].date)}
        </p>
      )}

      {actif > 1 && !rempli(actif) && rempli(actif - 1) && (
        <div className="cr-note cr-note--info">
          <span className="cr-note-icon" aria-hidden="true">●</span>
          <span>
            Journée semblable à la veille ?{' '}
            <button type="button" onClick={copierVeille} style={{
              background: 'none', border: 0, color: 'var(--red)', cursor: 'pointer',
              fontWeight: 600, fontSize: 13.5, fontFamily: 'inherit', padding: 0,
              textDecoration: 'underline',
            }}>
              Reprendre le jour {actif - 1}
            </button>{' '}
            — vous pourrez ensuite ajuster.
          </span>
        </div>
      )}

      {RUBRIQUES.map(r => (
        <div key={r.cle} style={{ marginBottom: 24 }}>
          <div className="cr-field-label" style={{ marginBottom: 8 }}>
            {r.titre}
          </div>
          <div className="cr-lines">
            {(courant[r.cle] || ['']).map((valeur, i) => (
              <div key={i} className="cr-line">
                <input
                  className="cr-input"
                  value={valeur}
                  placeholder={i === 0 ? r.exemple : 'Ajouter…'}
                  onChange={e => modifierLigne(r.cle, i, e.target.value)}
                />
                {(courant[r.cle] || []).length > 1 && (
                  <button type="button" className="cr-line-del"
                    onClick={() => retirerLigne(r.cle, i)}
                    title="Retirer" aria-label="Retirer cette ligne">×</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="cr-add" onClick={() => ajouterLigne(r.cle)}>
            + Ajouter
          </button>
        </div>
      ))}
    </div>
  )
}
