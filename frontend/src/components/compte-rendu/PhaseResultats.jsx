import { BAREMES, SEUIL, calculer, anomalies, afficher } from '../../utils/baremeCfao'

/**
 * Phase 2 — les notes brutes et les appreciations.
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
 */
export default function PhaseResultats({ brouillon, maj, session, synthese }) {
  const participants = (brouillon.participants || []).filter(p => p.present !== false)
  const baremes = brouillon.baremes || BAREMES

  function modifier(id, champ, valeur) {
    // On garde la chaine vide : un champ vide et un zero ne disent pas
    // la meme chose dans un compte rendu.
    const v = valeur === '' ? '' : valeur.replace(/[^\d]/g, '').slice(0, 3)
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, [champ]: v } : p),
    })
  }

  function apprecier(id, texte) {
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, appreciation: texte } : p),
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
          Saisissez les notes telles que vous les avez corrigées. Les
          pourcentages, la progression et le score final se calculent.
        </p>
      </div>

      <div className="cr-baremes">
        <span className="cr-baremes-label">Barèmes</span>
        {[
          ['entreeTheorique', 'Entrée théorique'],
          ['sortieTheorique', 'Sortie théorique'],
          ['sortiePratique', 'Sortie pratique'],
        ].map(([cle, libelle]) => (
          <label key={cle} className="cr-bareme">
            {libelle} sur
            <input className="cr-num cr-num--court" inputMode="numeric"
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
                    ['entreeBrut', 'entrée'],
                    ['sortieTheoBrut', 'théorie'],
                    ['sortiePratBrut', 'pratique'],
                  ].map(([champ, nom]) => (
                    <td key={champ}>
                      <input
                        className={`cr-num${erreurs.has(champ) ? ' cr-num--erreur' : ''}`}
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

      <div className="cr-sous-titre" style={{ marginTop: 30 }}>
        Appréciations
        <span className="cr-compte-doux">facultatif</span>
      </div>
      <p className="cr-vide-texte" style={{ marginTop: 0, marginBottom: 14 }}>
        Ce que les notes ne disent pas. Laissez vide et le texte sera
        rédigé à partir des seuls résultats.
      </p>
      <div className="cr-appreciations">
        {participants.map(p => {
          const c = calculer(p, baremes)
          return (
            <div key={p.id} className="cr-appreciation">
              <div className="cr-appreciation-tete">
                <span className="cr-name">{p.prenom} {p.nom}</span>
                <span className={`cr-calc${c.scoreFinal == null ? ' cr-calc--vide'
                  : c.scoreFinal >= SEUIL ? ' cr-calc--ok' : ' cr-calc--ko'}`}>
                  {afficher(c.scoreFinal)}
                </span>
              </div>
              <textarea className="cr-textarea" rows={2}
                value={p.appreciation || ''}
                placeholder="Assidu, à l’aise sur la pratique, reste à consolider la métrologie…"
                onChange={e => apprecier(p.id, e.target.value)}
                aria-label={`Appréciation de ${p.prenom} ${p.nom}`} />
            </div>
          )
        })}
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
