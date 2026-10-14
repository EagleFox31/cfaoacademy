/**
 * Verification de la liste des participants.
 *
 * La liste vient de l'inscription : le formateur la confirme plutot
 * qu'il ne la saisit. Ce qu'il corrige, c'est l'ecart entre les inscrits
 * et les presents — un absent inscrit fausserait tous les taux.
 *
 * Decocher quelqu'un ne le supprime pas : il reste visible, barre, et
 * peut etre rendu present d'un clic. Une suppression franche obligerait
 * a le ressaisir en cas d'erreur.
 */
export default function CrParticipants({ brouillon, maj }) {
  const participants = brouillon.participants || []
  const presents = participants.filter(p => p.present !== false)

  function basculer(id) {
    maj({
      participants: participants.map(p =>
        p.id === id ? { ...p, present: p.present === false } : p),
    })
  }

  function ajouter() {
    maj({
      participants: [...participants, {
        id: `ajout-${Date.now()}`,
        prenom: '', nom: '', pays: '', fonction: '',
        present: true, entree: '', sortie: '', theorie: '', pratique: '',
        ajoute: true,
      }],
    })
  }

  function modifier(id, champ, valeur) {
    maj({
      participants: participants.map(p =>
        p.id === id ? { ...p, [champ]: valeur } : p),
    })
  }

  function retirer(id) {
    maj({ participants: participants.filter(p => p.id !== id) })
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Qui était présent ?</h2>
        <p className="cr-panel-hint">
          La liste vient des inscriptions. Décochez les absents — ils resteront
          visibles et ne compteront pas dans les résultats.
        </p>
      </div>

      <div className="cr-note cr-note--info">
        <span className="cr-note-icon" aria-hidden="true">●</span>
        <span>
          <strong>{presents.length} présent{presents.length > 1 ? 's' : ''}</strong>
          {participants.length !== presents.length
            && ` sur ${participants.length} inscrit${participants.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th style={{ width: 52 }}>Présent</th>
              <th>Participant</th>
              <th>Pays</th>
              <th>Fonction</th>
              <th style={{ width: 44 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {participants.map(p => (
              <tr key={p.id} className={p.present === false ? 'cr-row--absent' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={p.present !== false}
                    onChange={() => basculer(p.id)}
                    aria-label={`${p.prenom} ${p.nom} présent`}
                    style={{ width: 17, height: 17, accentColor: 'var(--red)', cursor: 'pointer' }}
                  />
                </td>
                <td>
                  {p.ajoute ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="cr-input" style={{ width: 110 }} placeholder="Prénom"
                        value={p.prenom} onChange={e => modifier(p.id, 'prenom', e.target.value)} />
                      <input className="cr-input" style={{ width: 120 }} placeholder="NOM"
                        value={p.nom} onChange={e => modifier(p.id, 'nom', e.target.value)} />
                    </div>
                  ) : (
                    <div className="cr-name">
                      {p.prenom} {p.nom}
                    </div>
                  )}
                </td>
                <td>
                  {p.ajoute ? (
                    <input className="cr-input" style={{ width: 120 }} placeholder="Pays"
                      value={p.pays} onChange={e => modifier(p.id, 'pays', e.target.value)} />
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>{p.pays}</span>
                  )}
                </td>
                <td>
                  {p.ajoute ? (
                    <input className="cr-input" style={{ width: 140 }} placeholder="Fonction"
                      value={p.fonction} onChange={e => modifier(p.id, 'fonction', e.target.value)} />
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>{p.fonction}</span>
                  )}
                </td>
                <td>
                  {p.ajoute && (
                    <button type="button" className="cr-line-del" onClick={() => retirer(p.id)}
                      title="Retirer cette ligne" aria-label="Retirer">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="cr-add" onClick={ajouter}>
        + Ajouter un participant non inscrit
      </button>
    </div>
  )
}
