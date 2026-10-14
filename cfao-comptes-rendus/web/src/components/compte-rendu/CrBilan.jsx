import { useEffect } from 'react'
import { periodeLongue } from '../../utils/compteRendu'

/**
 * Le bilan de la session, propose puis relu.
 *
 * Les quatre rubriques sont celles du modele PowerPoint. Leur titre est
 * fixe ; leur corps est redige depuis les chiffres saisis.
 *
 * L'apercu montre ici ce que produira le moteur Python. Il ne remplace
 * pas la generation : c'est un echantillon, assez fidele pour que le
 * formateur juge du ton et repere une incoherence avant de lancer.
 *
 * La case de validation n'est pas une formalite. Un bilan est lu par la
 * hierarchie du centre et engage celui qui le signe ; demander une
 * relecture explicite vaut mieux qu'un texte qui part sans avoir ete lu.
 */
export default function CrBilan({ brouillon, maj, session, synthese }) {
  useEffect(() => {
    if (!brouillon.bilanVu) maj({ bilanVu: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rubriques = composer(session, synthese)
  const manque = rubriques.filter(r => !r.corps).map(r => r.titre)

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Le bilan de la session</h2>
        <p className="cr-panel-hint">
          Rédigé à partir des notes que vous avez saisies. Relisez-le : vous
          seul savez ce que les chiffres ne disent pas.
        </p>
      </div>

      {manque.length > 0 && (
        <div className="cr-note cr-note--warn">
          <span className="cr-note-icon" aria-hidden="true">●</span>
          <span>
            <strong>{manque.join(', ')}</strong> — il manque des données pour
            rédiger cette rubrique. Elle restera vide dans le rapport.
          </span>
        </div>
      )}

      {rubriques.map(r => (
        <div key={r.titre} className="cr-preview">
          <div className="cr-preview-head">{r.titre}</div>
          <p className={`cr-preview-text${r.corps ? '' : ' cr-preview-text--vide'}`}>
            {r.corps || 'Données insuffisantes pour cette rubrique.'}
          </p>
        </div>
      ))}

      <label className="cr-part" style={{ marginTop: 22 }}>
        <input
          type="checkbox"
          checked={!!brouillon.bilanValide}
          onChange={e => maj({ bilanValide: e.target.checked })}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span className="cr-part-check" aria-hidden="true">
          {brouillon.bilanValide ? '✓' : ''}
        </span>
        <span className="cr-part-body">
          <span className="cr-part-title">J’ai relu ce bilan</span>
          <span className="cr-part-desc">
            Le texte définitif sera produit à la génération et restera
            modifiable dans PowerPoint.
          </span>
        </span>
      </label>
    </div>
  )
}

/** Un apercu des quatre rubriques, dans l'esprit du moteur de redaction.
 *
 * Les formulations reprennent celles du lexique cote Python. Le moteur
 * en fait varier le choix ; ici une seule suffit a montrer le registre.
 */
function composer(session, s) {
  const lieu = session?.paysHote ? ` au Centre CFAO ${session.paysHote}` : ''
  const periode = periodeLongue(session?.debut, session?.fin)

  const contexte = session && s.effectif
    ? `La formation ${session.moduleFormation} s'est tenue ${periode}${lieu}, `
      + `avec ${s.effectif} participant${s.effectif > 1 ? 's' : ''}.`
    : ''

  let resultats = ''
  if (s.testEntree != null && s.testSortie != null) {
    resultats = `La moyenne théorique passe de ${s.testEntree} % à ${s.testSortie} %, `
      + `soit ${s.progression} point${Math.abs(s.progression) > 1 ? 's' : ''} de progression.`
  } else if (s.moyenneAcquisition != null) {
    resultats = `Le taux d'acquisition moyen du groupe s'établit à ${s.moyenneAcquisition} %.`
  }

  let vigilance = ''
  if (s.notesSaisies > 0) {
    vigilance = s.enRetrait === 0
      ? 'L\'ensemble des participants atteint le seuil de validation.'
      : `Le niveau final reste sous le seuil pour ${s.enRetrait} participant`
        + `${s.enRetrait > 1 ? 's' : ''} sur ${s.effectif}. `
        + 'Les profils étaient hétérogènes à l\'entrée.'
  }

  const suites = s.enRetrait > 0
    ? 'La reprise des modules e-learning s\'impose pour les participants en retrait.'
    : 'La mise en pratique en atelier consolidera ces acquis.'

  return [
    { titre: 'Contexte et appréciation', corps: contexte },
    { titre: 'Résultats et acquis', corps: resultats },
    { titre: 'Points de vigilance', corps: vigilance },
    { titre: 'Suites à donner', corps: s.notesSaisies > 0 ? suites : '' },
  ]
}
