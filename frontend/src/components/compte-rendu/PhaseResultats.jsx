import { useState } from 'react'
import { BAREMES, SEUIL, calculer, anomalies, afficher } from '../../utils/baremeCfao'
import {
  MENTIONS,
  CRITERES_FORMATION,
  CRITERES_ACCUEIL,
  syntheseSatisfaction,
  afficherTaux,
} from '../../utils/satisfactionCfao'

/**
 * Phase 2 — les notes brutes et la satisfaction des stagiaires.
 *
 * Le formateur saisit ce qu'il a corrige sur copie : 27 sur 30, 14 sur
 * 20. Les pourcentages, la progression et le score final se deduisent,
 * avec les formules des classeurs CFAO :
 *
 *     entree     = brut / 30        sortie theo = brut / 30
 *     pratique   = brut / 20        progression = (sortie - entree) / entree
 *     score      = moyenne(sortie theorique ; pratique)
 *
 * La progression est **relative** : passer de 50 % a 75 % fait +50 %,
 * pas +25. C'est ce qui produit les « 113 % » des comptes rendus, et
 * la colonne le rappelle pour qu'on ne le lise pas comme une erreur.
 *
 * La seconde moitie de l'ecran recueille la satisfaction, reprise du
 * classeur d'evaluation : sept criteres de qualite de formation, six
 * d'accueil, notes par mention et moyennes en taux (cf.
 * `utils/satisfactionCfao.js`).
 */
export default function PhaseResultats({
  brouillon, maj, session, synthese, onEnregistrer,
}) {
  const participants = (brouillon.participants || []).filter(p => p.present !== false)
  const baremes = brouillon.baremes || BAREMES

  // Un seul volet ouvert a la fois : les trois saisies sont
  // independantes, et trois tableaux deplies obligeaient a chercher
  // celui qu'on remplit.
  const [volet, setVolet] = useState('tests')

  // Le brouillon n'est plus ecrit a chaque frappe mais au changement de
  // volet : saisir douze notes declenchait autant d'ecritures.
  function ouvrir(cle) {
    if (cle === volet) return
    onEnregistrer?.()
    setVolet(cle)
  }

  function modifier(id, champ, valeur) {
    // On garde la chaine vide : un champ vide et un zero ne disent pas
    // la meme chose dans un compte rendu.
    const v = valeur === '' ? '' : valeur.replace(/[^\d]/g, '').slice(0, 3)
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, [champ]: v } : p),
    })
  }

  const reponses = brouillon.satisfaction || {}
  const satisfaction = syntheseSatisfaction(reponses)

  function repondre(idParticipant, critere, mention) {
    maj({
      satisfaction: {
        ...reponses,
        [idParticipant]: { ...reponses[idParticipant], [critere]: mention },
      },
    })
  }

  function majBareme(cle, valeur) {
    const n = Number(valeur)
    maj({ baremes: { ...baremes, [cle]: Number.isNaN(n) || n <= 0 ? 1 : n } })
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Les résultats de la session</h2>
        <p className="cr-panel-hint">
          Trois volets : les notes des tests, puis les deux
          questionnaires de fin de session. Dépliez celui que vous
          remplissez.
        </p>
      </div>

      <div className="cr-blocs">
        <Bloc titre="Résultats des tests"
          resume={`${synthese.saisis}/${synthese.effectif} saisis`}
          valeur={afficher(synthese.scoreFinal)}
          ton={synthese.scoreFinal == null ? null
            : synthese.scoreFinal >= SEUIL ? 'ok' : 'ko'}
          ouvert={volet === 'tests'} onOuvrir={() => ouvrir('tests')}>
          <div className="cr-baremes">
            <span className="cr-baremes-label">Barèmes</span>
            {[
              ['entreeTheorique', 'Entrée théorique'],
              ['sortieTheorique', 'Sortie théorique'],
              ['sortiePratique', 'Sortie pratique'],
            ].map(([cle, libelle]) => (
              <label key={cle} className="cr-bareme">
                {libelle} sur
                <input className="cr-num cr-num--court" type="number"
                  min="1" max="200" inputMode="numeric"
                  value={baremes[cle]} onChange={e => majBareme(cle, e.target.value)}
                  aria-label={`Barème ${libelle}`} />
              </label>
            ))}
          </div>

          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th style={{ width: 84 }}>Entrée<small>/{baremes.entreeTheorique}</small></th>
                  <th style={{ width: 84 }}>Théorie<small>/{baremes.sortieTheorique}</small></th>
                  <th style={{ width: 84 }}>Pratique<small>/{baremes.sortiePratique}</small></th>
                  <th style={{ width: 96 }}>Progression</th>
                  <th style={{ width: 96 }}>Score final</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => {
                  const c = calculer(p, baremes)
                  const faits = anomalies(p, baremes)
                  const erreurs = new Set(faits.filter(f => f.niveau === 'erreur').map(f => f.champ))
                  const avertis = faits.filter(f => f.niveau === 'avertissement')

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cr-name">
                          {p.prenom} {p.nom}
                          <small>{p.pays}</small>
                        </div>
                      </td>
                      {[
                        ['entreeBrut', 'entrée', 'entreeTheorique'],
                        ['sortieTheoBrut', 'théorie', 'sortieTheorique'],
                        ['sortiePratBrut', 'pratique', 'sortiePratique'],
                      ].map(([champ, nom, bareme]) => (
                        <td key={champ}>
                          <input
                            className={`cr-num${erreurs.has(champ) ? ' cr-num--erreur' : ''}`}
                            type="number" min="0" max={baremes[bareme]}
                            inputMode="numeric" value={p[champ] ?? ''}
                            onChange={e => modifier(p.id, champ, e.target.value)}
                            placeholder="—"
                            aria-label={`Note ${nom} de ${p.prenom} ${p.nom}`} />
                        </td>
                      ))}
                      <td>
                        <span className={`cr-calc${c.progression == null ? ' cr-calc--vide'
                          : c.progression > 0 ? ' cr-calc--ok'
                            : c.progression < 0 ? ' cr-calc--ko' : ''}`}>
                          {c.progression == null ? '—'
                            : `${c.progression > 0 ? '+' : ''}${c.progression} %`}
                        </span>
                      </td>
                      <td>
                        <span className={`cr-calc${c.scoreFinal == null ? ' cr-calc--vide'
                          : c.scoreFinal >= SEUIL ? ' cr-calc--ok' : ' cr-calc--ko'}`}>
                          {afficher(c.scoreFinal)}
                        </span>
                        {avertis.map(a => (
                          <div key={a.champ} className="cr-avertissement">{a.message}</div>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {synthese.saisis > 0 && (
            <div className="cr-kpis" style={{ marginTop: 20 }}>
              <Indicateur valeur={afficher(synthese.scoreFinal)} legende="Score moyen" />
              <Indicateur
                valeur={synthese.progression == null ? '—'
                  : `${synthese.progression > 0 ? '+' : ''}${synthese.progression} %`}
                legende="Progression moyenne" />
              <Indicateur valeur={synthese.enRetrait}
                legende={`Sous le seuil de ${SEUIL} %`}
                ton={synthese.enRetrait === 0 ? 'ok' : 'ko'} />
              <Indicateur valeur={`${synthese.saisis}/${synthese.effectif}`}
                legende="Résultats saisis" />
            </div>
          )}

          {synthese.saisis > 0 && (
            <div className="cr-kpis" style={{ marginTop: 18 }}>
              <Indicateur valeur={afficher(synthese.scoreFinal)} legende="Score moyen" />
              <Indicateur
                valeur={synthese.progression == null ? '—'
                  : `${synthese.progression > 0 ? '+' : ''}${synthese.progression} %`}
                legende="Progression moyenne" />
              <Indicateur valeur={synthese.enRetrait}
                legende={`Sous le seuil de ${SEUIL} %`}
                ton={synthese.enRetrait === 0 ? 'ok' : 'ko'} />
              <Indicateur valeur={`${synthese.saisis}/${synthese.effectif}`}
                legende="Résultats saisis" />
            </div>
          )}
        </Bloc>

        <Bloc titre="Qualité de la formation"
          resume={`${CRITERES_FORMATION.length} critères`}
          valeur={afficherTaux(satisfaction.formation)}
          ton={satisfaction.formation == null ? null
            : satisfaction.formation >= 75 ? 'ok' : null}
          ouvert={volet === 'formation'} onOuvrir={() => ouvrir('formation')}>
          <GrilleCriteres criteres={CRITERES_FORMATION}
            participants={participants} reponses={reponses}
            onRepondre={repondre} />
        </Bloc>

        <Bloc titre="Qualité de l’accueil"
          resume={`${CRITERES_ACCUEIL.length} critères`}
          valeur={afficherTaux(satisfaction.accueil)}
          ton={satisfaction.accueil == null ? null
            : satisfaction.accueil >= 75 ? 'ok' : null}
          ouvert={volet === 'accueil'} onOuvrir={() => ouvrir('accueil')}>
          <GrilleCriteres criteres={CRITERES_ACCUEIL}
            participants={participants} reponses={reponses}
            onRepondre={repondre} />
        </Bloc>
      </div>
    </div>
  )
}

function Indicateur({ valeur, legende, ton }) {
  return (
    <div className="cr-kpi">
      <div className={`cr-kpi-val${ton ? ` cr-kpi-val--${ton}` : ''}`}>{valeur}</div>
      <div className="cr-kpi-lab">{legende}</div>
    </div>
  )
}

/** Un volet depliable, ouvert ou non selon le parent.
 *
 *  L'en-tete porte l'indicateur du volet : replie, il dit deja ou en
 *  est la saisie. Un seul volet est ouvert a la fois — les trois
 *  chiffres restent lisibles en permanence dans les en-tetes.
 */
function Bloc({ titre, resume, valeur, ton, ouvert, onOuvrir, children }) {
  return (
    <div className={`cr-bloc${ouvert ? ' cr-bloc--ouvert' : ''}`}>
      <h3 className="cr-bloc-titre">
        <button type="button" className="cr-bloc-bouton"
          aria-expanded={ouvert} onClick={onOuvrir}>
          <span className="cr-bloc-fleche" aria-hidden="true">▸</span>
          <span className="cr-bloc-nom">{titre}</span>
          <span className="cr-bloc-resume">{resume}</span>
          <span className={`cr-calc${ton ? ` cr-calc--${ton}` : ' cr-calc--vide'}`}>
            {valeur}
          </span>
        </button>
      </h3>
      {ouvert && <div className="cr-bloc-corps">{children}</div>}
    </div>
  )
}

/** Une grille de criteres : une ligne par critere, une colonne par
 *  stagiaire. Le tableau croise tient sur un ecran la ou treize champs
 *  par personne demanderaient une page entiere. */
function GrilleCriteres({ criteres, participants, reponses, onRepondre }) {
  return (
    <div className="cr-satisfaction">
      <div className="cr-satis-entete">
        <span className="cr-satis-critere">Critère</span>
        {participants.map(p => (
          <span key={p.id} className="cr-satis-nom" title={`${p.prenom} ${p.nom}`}>
            {p.prenom} {p.nom.slice(0, 1)}.
          </span>
        ))}
      </div>
      {criteres.map(c => (
        <div key={c.cle} className="cr-satis-ligne">
          <span className="cr-satis-critere" title={c.libelle}>{c.libelle}</span>
          {participants.map(p => (
            <select key={p.id} className="cr-satis-choix"
              value={reponses[p.id]?.[c.cle] || ''}
              onChange={e => onRepondre(p.id, c.cle, e.target.value)}
              aria-label={`${c.libelle} — ${p.prenom} ${p.nom}`}>
              <option value="">—</option>
              {MENTIONS.map(m => (
                <option key={m.cle} value={m.cle}>{m.signe} {m.libelle}</option>
              ))}
            </select>
          ))}
        </div>
      ))}
    </div>
  )
}
