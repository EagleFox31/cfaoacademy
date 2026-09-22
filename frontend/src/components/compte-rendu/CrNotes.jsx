import { SEUIL_DEFAUT } from '../../utils/compteRendu'

/**
 * Saisie des notes, participant par participant.
 *
 * C'est l'ecran le plus utilise du parcours, et le plus fastidieux :
 * quatre nombres par personne, parfois douze personnes. Trois choix en
 * decoulent :
 *
 *   * le taux d'acquisition s'affiche des que les deux notes sont la,
 *     avec sa couleur — le formateur voit le resultat sans attendre la
 *     page de synthese ;
 *   * la tabulation suit l'ordre de lecture, ligne par ligne, pour une
 *     saisie au clavier sans souris ;
 *   * une note hors bornes est signalee sur le champ, pas dans un
 *     bandeau en haut de page qu'il faudrait aller chercher.
 *
 * Rien n'est bloquant : une session peut se terminer sans que toutes
 * les notes soient connues, et le formateur reviendra.
 */
export default function CrNotes({ brouillon, maj, session, synthese, anomalies, calcul }) {
  const seuil = session?.seuil ?? SEUIL_DEFAUT
  const participants = (brouillon.participants || []).filter(p => p.present !== false)

  function modifier(id, champ, valeur) {
    // On garde la chaine vide plutot que zero : un champ vide et un
    // zero n'ont pas le meme sens dans un compte rendu.
    const v = valeur === '' ? '' : valeur.replace(/[^\d]/g, '').slice(0, 3)
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, [champ]: v } : p),
    })
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Les notes de la session</h2>
        <p className="cr-panel-hint">
          Saisissez ce que vous avez. Le taux d’acquisition est la moyenne de la
          théorie et de la pratique — il se calcule tout seul. Vous pourrez
          revenir compléter plus tard.
        </p>
      </div>

      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th style={{ width: 96 }}>Test entrée</th>
              <th style={{ width: 96 }}>Test sortie</th>
              <th style={{ width: 96 }}>Théorie</th>
              <th style={{ width: 96 }}>Pratique</th>
              <th style={{ width: 110 }}>Acquisition</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => {
              const faits = anomalies(p)
              const erreurs = new Set(
                faits.filter(f => f.niveau === 'erreur').map(f => f.champ))
              const taux = calcul(p)
              const classe = taux == null ? 'cr-calc cr-calc--vide'
                : taux >= seuil ? 'cr-calc cr-calc--ok' : 'cr-calc cr-calc--ko'

              return (
                <tr key={p.id}>
                  <td>
                    <div className="cr-name">
                      {p.prenom} {p.nom}
                      <small>{p.pays}</small>
                    </div>
                  </td>
                  {['entree', 'sortie', 'theorie', 'pratique'].map(champ => (
                    <td key={champ}>
                      <input
                        className={`cr-num${erreurs.has(champ) ? ' cr-num--erreur' : ''}`}
                        inputMode="numeric"
                        value={p[champ] ?? ''}
                        onChange={e => modifier(p.id, champ, e.target.value)}
                        placeholder="—"
                        aria-label={`${champ} de ${p.prenom} ${p.nom}`}
                      />
                    </td>
                  ))}
                  <td>
                    <span className={classe}>
                      {taux == null ? '—' : `${taux} %`}
                    </span>
                    {faits.filter(f => f.niveau === 'avertissement').map(f => (
                      <div key={f.champ} style={{
                        fontSize: 11, color: '#8a5200', marginTop: 3, lineHeight: 1.3,
                      }}>
                        {f.message}
                      </div>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {synthese.notesSaisies > 0 && (
        <div className="cr-kpis" style={{ marginTop: 22, marginBottom: 0 }}>
          <div className="cr-kpi">
            <div className="cr-kpi-val">{synthese.moyenneAcquisition ?? '—'}<span style={{ fontSize: 16 }}> %</span></div>
            <div className="cr-kpi-lab">Acquisition moyenne</div>
          </div>
          <div className="cr-kpi">
            <div className="cr-kpi-val">
              {synthese.progression == null ? '—'
                : `${synthese.progression > 0 ? '+' : ''}${synthese.progression}`}
            </div>
            <div className="cr-kpi-lab">Points de progression</div>
          </div>
          <div className="cr-kpi">
            <div className={`cr-kpi-val${synthese.enRetrait === 0 ? ' cr-kpi-val--ok' : ' cr-kpi-val--ko'}`}>
              {synthese.enRetrait}
            </div>
            <div className="cr-kpi-lab">Sous le seuil de {seuil} %</div>
          </div>
          <div className="cr-kpi">
            <div className="cr-kpi-val">{synthese.notesSaisies}<span style={{ fontSize: 16, color: 'var(--muted-2)' }}>/{synthese.effectif}</span></div>
            <div className="cr-kpi-lab">Notes renseignées</div>
          </div>
        </div>
      )}
    </div>
  )
}
