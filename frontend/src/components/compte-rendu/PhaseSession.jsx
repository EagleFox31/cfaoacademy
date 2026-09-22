import { useState } from 'react'
import { periodeLongue } from '../../utils/compteRendu'

/**
 * Phase 1 — quelle formation, et qui l'a suivie.
 *
 * Deux entrees, parce que deux situations existent :
 *
 *   * la session figure au planning — tout est deja connu, le
 *     formateur confirme ;
 *   * elle n'y figure pas — formation improvisee, intervention chez un
 *     client, session d'un autre centre. Le formateur saisit alors les
 *     details lui-meme.
 *
 * Le second cas n'est pas un repli : c'est un chemin de plein droit,
 * affiche a cote du premier. Le cacher derriere un lien obligerait a
 * chercher, et ces sessions-la existent bel et bien.
 */
export default function PhaseSession({
  brouillon, maj, sessions, onChoisirSession, onSaisieManuelle,
}) {
  const [mode, setMode] = useState(
    brouillon.manuel ? 'manuel' : brouillon.sessionId ? 'planning' : null)

  function choisir(s) {
    onChoisirSession(s)
    setMode('planning')
  }

  function passerEnManuel() {
    onSaisieManuelle()
    setMode('manuel')
  }

  // ── Choix du mode, tant que rien n'est engage
  if (!mode) {
    const proposables = sessions.filter(s => s.statut !== 'a_venir')
    return (
      <div className="cr-panel">
        <div className="cr-panel-head">
          <h2 className="cr-panel-title">De quelle formation s’agit-il ?</h2>
          <p className="cr-panel-hint">
            Choisissez-la dans vos sessions, ou saisissez les informations
            vous-même si elle n’y figure pas.
          </p>
        </div>

        <div className="cr-session-grid">
          {proposables.map(s => (
            <button key={s.id} type="button" className="cr-session"
              onClick={() => choisir(s)}>
              <div className="cr-session-top">
                <span className="cr-session-code">{s.codeSession}</span>
                {s.statut === 'a_rediger' && (
                  <span className="cr-badge cr-badge--warn">À rédiger</span>
                )}
              </div>
              <h3 className="cr-session-title">{s.moduleFormation}</h3>
              <div className="cr-session-meta">
                <span>{periodeLongue(s.debut, s.fin)}</span>
                <span>{s.participants.length} participants</span>
              </div>
              <div className="cr-session-meta">
                <span>{s.marque}</span>
                <span>{s.lieu}</span>
              </div>
            </button>
          ))}

          <button type="button" className="cr-session cr-session--manuel"
            onClick={passerEnManuel}>
            <div className="cr-session-top">
              <span className="cr-session-code">SAISIE LIBRE</span>
            </div>
            <h3 className="cr-session-title">Formation hors planning</h3>
            <div className="cr-session-meta">
              <span>Renseigner l’intitulé, les dates et les participants</span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Saisie manuelle
  if (mode === 'manuel') {
    return (
      <div className="cr-panel">
        <div className="cr-panel-head">
          <h2 className="cr-panel-title">Les informations de la formation</h2>
          <p className="cr-panel-hint">
            Renseignez ce que vous savez. L’intitulé et les participants
            suffisent pour commencer.
          </p>
        </div>

        <div className="cr-form-grid">
          <Champ label="Intitulé de la formation" large
            valeur={brouillon.intitule}
            surSaisie={v => maj({ intitule: v })}
            exemple="Révision des organes châssis" />
          <Champ label="Code" valeur={brouillon.codeFormation}
            surSaisie={v => maj({ codeFormation: v })} exemple="TS05-G3" />
          <Champ label="Marque" valeur={brouillon.marque}
            surSaisie={v => maj({ marque: v })} exemple="TOYOTA" />
          <Champ label="Début" type="date" valeur={brouillon.debut}
            surSaisie={v => maj({ debut: v })} />
          <Champ label="Fin" type="date" valeur={brouillon.fin}
            surSaisie={v => maj({ fin: v })} />
          <Champ label="Lieu" valeur={brouillon.lieu}
            surSaisie={v => maj({ lieu: v })}
            exemple="Centre CFAO Academy — Douala" />
          <Champ label="Pays" valeur={brouillon.pays}
            surSaisie={v => maj({ pays: v })} exemple="Cameroun" />
        </div>

        <ListeParticipants brouillon={brouillon} maj={maj} modifiable />

        <button type="button" className="cr-add" onClick={() => setMode(null)}>
          ← Choisir plutôt une session du planning
        </button>
      </div>
    )
  }

  // ── Session reprise du planning : verification
  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Vérifiez les informations</h2>
        <p className="cr-panel-hint">
          Tout vient du planning. Décochez les absents, ajoutez un
          participant non inscrit si besoin.
        </p>
      </div>

      <div className="cr-recap">
        <Ligne cle="Formation" valeur={brouillon.intitule} />
        <Ligne cle="Code" valeur={brouillon.codeFormation} />
        <Ligne cle="Période" valeur={periodeLongue(brouillon.debut, brouillon.fin)} />
        <Ligne cle="Lieu" valeur={brouillon.lieu} />
        <Ligne cle="Marque" valeur={brouillon.marque} />
      </div>

      <ListeParticipants brouillon={brouillon} maj={maj} />

      <button type="button" className="cr-add" onClick={() => setMode(null)}>
        ← Changer de session
      </button>
    </div>
  )
}

function Ligne({ cle, valeur }) {
  if (!valeur) return null
  return (
    <div className="cr-recap-ligne">
      <span className="cr-recap-cle">{cle}</span>
      <span className="cr-recap-val">{valeur}</span>
    </div>
  )
}

function Champ({ label, valeur, surSaisie, exemple, type = 'text', large }) {
  return (
    <label className={`cr-field${large ? ' cr-field--large' : ''}`}>
      <span className="cr-field-label">{label}</span>
      <input className="cr-input" type={type} value={valeur || ''}
        placeholder={exemple} onChange={e => surSaisie(e.target.value)} />
    </label>
  )
}

/** La liste des participants, en lecture ou en saisie. */
function ListeParticipants({ brouillon, maj, modifiable }) {
  const participants = brouillon.participants || []
  const presents = participants.filter(p => p.present !== false)

  function basculer(id) {
    maj({
      participants: participants.map(p =>
        p.id === id ? { ...p, present: p.present === false } : p),
    })
  }

  function modifier(id, champ, v) {
    maj({
      participants: participants.map(p =>
        p.id === id ? { ...p, [champ]: v } : p),
    })
  }

  function ajouter() {
    maj({
      participants: [...participants, {
        id: `p-${Date.now()}`, prenom: '', nom: '', pays: '', fonction: '',
        present: true, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
        appreciation: '', ajoute: true,
      }],
    })
  }

  function retirer(id) {
    maj({ participants: participants.filter(p => p.id !== id) })
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className="cr-sous-titre">
        Participants
        <span className="cr-compte">{presents.length}</span>
      </div>

      {participants.length === 0 ? (
        <p className="cr-vide-texte">
          Aucun participant. Ajoutez-les pour continuer.
        </p>
      ) : (
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>Présent</th>
                <th>Participant</th>
                <th>Pays</th>
                <th>Fonction</th>
                <th style={{ width: 44 }} aria-label="Retirer" />
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.id} className={p.present === false ? 'cr-row--absent' : undefined}>
                  <td>
                    <input type="checkbox" checked={p.present !== false}
                      onChange={() => basculer(p.id)}
                      aria-label={`${p.prenom} ${p.nom} présent`}
                      style={{ width: 17, height: 17, accentColor: 'var(--red)', cursor: 'pointer' }} />
                  </td>
                  <td>
                    {(modifiable || p.ajoute) ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="cr-input" style={{ width: 106 }} placeholder="Prénom"
                          value={p.prenom} onChange={e => modifier(p.id, 'prenom', e.target.value)} />
                        <input className="cr-input" style={{ width: 116 }} placeholder="NOM"
                          value={p.nom} onChange={e => modifier(p.id, 'nom', e.target.value)} />
                      </div>
                    ) : (
                      <span className="cr-name">{p.prenom} {p.nom}</span>
                    )}
                  </td>
                  <td>
                    {(modifiable || p.ajoute) ? (
                      <input className="cr-input" style={{ width: 116 }} placeholder="Pays"
                        value={p.pays} onChange={e => modifier(p.id, 'pays', e.target.value)} />
                    ) : (
                      <span className="cr-doux">{p.pays}</span>
                    )}
                  </td>
                  <td>
                    {(modifiable || p.ajoute) ? (
                      <input className="cr-input" style={{ width: 136 }} placeholder="Fonction"
                        value={p.fonction} onChange={e => modifier(p.id, 'fonction', e.target.value)} />
                    ) : (
                      <span className="cr-doux">{p.fonction}</span>
                    )}
                  </td>
                  <td>
                    {(modifiable || p.ajoute) && (
                      <button type="button" className="cr-line-del"
                        onClick={() => retirer(p.id)} aria-label="Retirer">×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="cr-add" onClick={ajouter}>
        + Ajouter un participant
      </button>
    </div>
  )
}
