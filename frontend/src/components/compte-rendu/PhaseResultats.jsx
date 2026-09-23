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

          {/* L'en-tete reste visible pendant qu'on descend dans la liste :
              au huitieme stagiaire, on ne sait plus quelle colonne est la
              theorie. Les largeurs sont fixes pour que les notes restent
              alignees quelle que soit la longueur des noms. */}
          <div className="cr-table-wrap cr-table-wrap--fige">
            <table className="cr-table cr-table--notes">
              <colgroup>
                <col />
                <col style={{ width: 104 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 118 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Entrée<small>/{baremes.entreeTheorique}</small></th>
                  <th>Théorie<small>/{baremes.sortieTheorique}</small></th>
                  <th>Pratique<small>/{baremes.sortiePratique}</small></th>
                  <th>Progression</th>
                  <th>Score final</th>
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

/** Le trace de chaque mention, au trait.
 *
 *  Des formes nettement differentes plutot qu'une gradation de visages :
 *  cinq sourires voisins se confondent au clic, une etoile et une croix
 *  jamais. Pas d'emoji, dont le rendu change d'un poste a l'autre. Au
 *  repos les icones sont au trait et sans couleur ; la mention retenue
 *  prend la sienne, du vert au rouge, pour lire la grille d'un coup.
 */
const TRACES = {
  tres_satisfaisant: (
    <path d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.72l-5.12 2.69.98-5.72L3.7 9.64l5.75-.84z" />
  ),
  satisfaisant: (
    <>
      <path d="M7.5 10.5V20" />
      <path d="M14.6 6.2 14 10.5h4.9a1.8 1.8 0 0 1 1.75 2.2l-1.45 6A1.8 1.8 0 0 1 17.45 20H5.3a1.3 1.3 0 0 1-1.3-1.3v-6.9a1.3 1.3 0 0 1 1.3-1.3h2.2L10.9 4a1.9 1.9 0 0 1 3.7 2.2z" />
    </>
  ),
  moyen: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.2 12h7.6" />
    </>
  ),
  peu_satisfaisant: (
    <>
      <path d="M16.5 13.5V4" />
      <path d="M9.4 17.8 10 13.5H5.1a1.8 1.8 0 0 1-1.75-2.2l1.45-6A1.8 1.8 0 0 1 6.55 4H18.7a1.3 1.3 0 0 1 1.3 1.3v6.9a1.3 1.3 0 0 1-1.3 1.3h-2.2L13.1 20a1.9 1.9 0 0 1-3.7-2.2z" />
    </>
  ),
  insatisfaisant: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
}

function IconeMention({ cle }) {
  return (
    <svg className="cr-mention-icone" viewBox="0 0 24 24" width="18" height="18"
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACES[cle]}
    </svg>
  )
}

/** Une grille de criteres : une ligne par critere, une colonne par
 *  stagiaire.
 *
 *  Les criteres restent figes a gauche et les noms en tete : on fait
 *  defiler les stagiaires sans perdre de vue ni la question ni la
 *  personne. Chaque case offre les cinq mentions en icones ; un second
 *  clic sur la mention retenue l'efface.
 */
function GrilleCriteres({ criteres, participants, reponses, onRepondre }) {
  return (
    <div className="cr-satisfaction">
      <ul className="cr-mentions-legende" aria-label="Mentions">
        {MENTIONS.map(m => (
          <li key={m.cle} className={`cr-mention--${m.cle}`}>
            <IconeMention cle={m.cle} />
            {m.libelle}
          </li>
        ))}
      </ul>

      <div className="cr-satis-wrap">
        <table className="cr-satis-table">
          <colgroup>
            <col className="cr-satis-col-critere" />
            {participants.map(p => <col key={p.id} className="cr-satis-col" />)}
          </colgroup>
          <thead>
            <tr>
              <th className="cr-satis-coin" scope="col">Critère</th>
              {participants.map(p => {
                const siennes = reponses[p.id] || {}
                const faites = criteres.filter(c => siennes[c.cle]).length
                return (
                  <th key={p.id} scope="col" className="cr-satis-nom"
                    title={`${p.prenom} ${p.nom}`}>
                    <span className="cr-satis-nom-texte">{p.prenom} {p.nom}</span>
                    <small className={faites === criteres.length ? 'cr-satis-complet' : undefined}>
                      {faites}/{criteres.length}
                    </small>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {criteres.map(c => (
              <tr key={c.cle}>
                <th scope="row" className="cr-satis-critere" title={c.libelle}>
                  {c.libelle}
                </th>
                {participants.map(p => {
                  const choisie = reponses[p.id]?.[c.cle] || ''
                  return (
                    <td key={p.id}>
                      <div className={`cr-mentions${choisie ? ' cr-mentions--rempli' : ''}`}
                        role="radiogroup"
                        aria-label={`${c.libelle} — ${p.prenom} ${p.nom}`}>
                        {MENTIONS.map(m => {
                          const on = choisie === m.cle
                          return (
                            <button key={m.cle} type="button" role="radio"
                              aria-checked={on}
                              className={`cr-mention cr-mention--${m.cle}${on ? ' cr-mention--on' : ''}`}
                              title={m.libelle}
                              aria-label={m.libelle}
                              onClick={() => onRepondre(p.id, c.cle, on ? '' : m.cle)}>
                              <IconeMention cle={m.cle} />
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
