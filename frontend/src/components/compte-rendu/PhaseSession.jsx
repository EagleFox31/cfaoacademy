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
 * Le second cas reste visible en permanence, sous la liste, comme le
 * « Je n'ai pas de compte » d'un formulaire de connexion. Presente en
 * sixieme carte de la grille, au meme format que les sessions, il se
 * lisait comme une session de plus et personne ne le voyait.
 */
export default function PhaseSession({
  brouillon, maj, sessions, onChoisirSession, onSaisieManuelle,
}) {
  // Le mode se deduit du brouillon : l'orchestrateur porte le bouton de
  // retour dans sa barre fixe, et doit pouvoir revenir au choix sans
  // qu'un etat local vienne le contredire.
  const mode = brouillon.manuel ? 'manuel'
    : brouillon.sessionId ? 'planning' : null

  const choisir = s => onChoisirSession(s)
  const passerEnManuel = () => onSaisieManuelle()

  // ── Choix du mode, tant que rien n'est engage
  if (!mode) {
    const proposables = sessions.filter(s => s.statut !== 'a_venir')
    return (
      <div className="cr-panel cr-panel--choix">
        <div className="cr-panel-head">
          <h2 className="cr-panel-title">De quelle formation s’agit-il ?</h2>
          <p className="cr-panel-hint">
            Choisissez-la parmi vos sessions.
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
        </div>

        {/* Sous la liste, comme le « Je n'ai pas de compte » d'un
            formulaire de connexion : la ou le regard arrive quand il
            n'a rien trouve au-dessus, et jamais noye dans la grille. */}
        <div className="cr-echappee">
          <span className="cr-echappee-texte">
            Vous ne trouvez pas votre formation dans la liste ?
          </span>
          <button type="button" className="cr-echappee-lien"
            onClick={passerEnManuel}>
            Saisir les informations moi-même →
          </button>
        </div>
      </div>
    )
  }

  // ── Saisie manuelle
  if (mode === 'manuel') {
    return (
      <div className="cr-panel cr-panel--formulaire">
        <div className="cr-panel-head">
          <h2 className="cr-panel-title">Les informations de la formation</h2>
          <p className="cr-panel-hint">
            Renseignez ce que vous savez. L’intitulé et le nombre de
            participants suffisent pour commencer.
          </p>
        </div>

        <div className="cr-form">
          {/* Une ligne par nature d'information : ce qui identifie la
              formation, quand elle a eu lieu, ou et avec combien de
              personnes. */}
          <div className="cr-form-ligne cr-form-ligne--code-intitule">
            <Champ label="Code" valeur={brouillon.codeFormation}
              surSaisie={v => maj({ codeFormation: v })} exemple="TS05-G3" />
            <Champ label="Intitulé de la formation"
              valeur={brouillon.intitule}
              surSaisie={v => maj({ intitule: v })}
              exemple="Révision et réparation des organes châssis" />
          </div>

          <div className="cr-form-ligne cr-form-ligne--trois">
            <Champ label="Marque" valeur={brouillon.marque}
              surSaisie={v => maj({ marque: v })} exemple="TOYOTA" />
            <Champ label="Début" type="date" valeur={brouillon.debut}
              surSaisie={v => maj({ debut: v })} />
            <Champ label="Fin" type="date" valeur={brouillon.fin}
              surSaisie={v => maj({ fin: v })} />
          </div>

          <div className="cr-form-ligne cr-form-ligne--trois">
            <Champ label="Lieu" valeur={brouillon.lieu}
              surSaisie={v => maj({ lieu: v })}
              exemple="Centre CFAO Academy — Douala" />
            <Champ label="Pays" valeur={brouillon.pays}
              surSaisie={v => maj({ pays: v })} exemple="Cameroun" />
            <ChampEffectif brouillon={brouillon} maj={maj} />
          </div>
        </div>

        <ListeParticipants brouillon={brouillon} maj={maj} modifiable />
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

/** Le nombre de participants, qui crée ou retire les lignes du tableau.
 *
 *  Saisir « 6 » est plus rapide que cliquer six fois « Ajouter ». La
 *  reduction ne retire que des lignes vides, en partant de la fin : un
 *  nom deja saisi ne doit pas disparaitre sur une faute de frappe.
 */
function ChampEffectif({ brouillon, maj }) {
  const participants = brouillon.participants || []

  function ajuster(saisie) {
    const voulu = saisie === '' ? 0 : Math.min(Number(saisie) || 0, 60)
    if (voulu === participants.length) return

    if (voulu > participants.length) {
      const ajouts = Array.from(
        { length: voulu - participants.length },
        (_, i) => ligneVide(participants.length + i))
      maj({ participants: [...participants, ...ajouts] })
      return
    }

    // On n'enleve que des lignes restees vides, de la derniere a la
    // premiere. Une ligne deja renseignee se retire a la croix : elle ne
    // doit pas disparaitre sur une faute de frappe dans ce champ.
    const restants = [...participants]
    for (let i = restants.length - 1; i >= 0 && restants.length > voulu; i--) {
      if (estVide(restants[i])) restants.splice(i, 1)
    }
    maj({ participants: restants })
  }

  return (
    <label className="cr-field">
      <span className="cr-field-label">Nombre de participants</span>
      <input className="cr-input cr-input--nombre" type="number"
        min="0" max="60" inputMode="numeric"
        value={participants.length || ''}
        placeholder="0"
        onChange={e => ajuster(e.target.value)} />
    </label>
  )
}

function ligneVide(index) {
  return {
    id: `p-${Date.now()}-${index}`,
    prenom: '', nom: '', pays: '', fonction: '',
    present: true, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
    appreciation: '', ajoute: true,
  }
}

function estVide(p) {
  return !p.prenom?.trim() && !p.nom?.trim()
    && !p.pays?.trim() && !p.fonction?.trim()
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

  function retirer(id) {
    maj({ participants: participants.filter(p => p.id !== id) })
  }

  return (
    <div className="cr-participants">
      <div className="cr-sous-titre">
        Participants
        <span className="cr-compte">{presents.length}</span>
      </div>

      {participants.length === 0 ? (
        <p className="cr-vide-texte">
          Indiquez le nombre de participants ci-dessus : les lignes à
          renseigner apparaîtront ici.
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

    </div>
  )
}
