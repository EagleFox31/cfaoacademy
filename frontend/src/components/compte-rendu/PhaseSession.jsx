import { useRef, useState } from 'react'
import { periodeLongue } from '../../utils/compteRendu'
import { lireEvaluation, appliquerEvaluation } from '../../utils/importEvaluation'

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

  // Un classeur d'evaluation porte deja la formation et ses stagiaires :
  // l'importer evite de recopier vingt noms a la main. Sur le choix
  // initial, il cree la saisie ; dans la saisie, il la complete sans
  // ecraser ce qui y est deja ecrit.
  const fichier = useRef(null)
  const [importInfo, setImportInfo] = useState(null)
  async function importer(f) {
    if (!f) return
    try {
      const { entete, stagiaires } = await lireEvaluation(f)
      if (!mode) {
        const r = appliquerEvaluation({ participants: [] }, stagiaires)
        onSaisieManuelle({
          ...Object.fromEntries(Object.entries(entete).filter(([, v]) => v)),
          participants: r.participants, satisfaction: r.satisfaction,
        })
      } else {
        const r = appliquerEvaluation(brouillon, stagiaires)
        if (r.remplaces && !window.confirm(
          `Le classeur remplace des notes déjà saisies pour ${r.remplaces} stagiaire`
          + `${r.remplaces > 1 ? 's' : ''}. Continuer ?`)) return
        const vides = Object.fromEntries(Object.entries(entete)
          .filter(([k, v]) => v && !String(brouillon[k] || '').trim()))
        maj({ ...vides, participants: r.participants, satisfaction: r.satisfaction })
      }
      setImportInfo({
        ok: true,
        texte: `${stagiaires.length} stagiaire${stagiaires.length > 1 ? 's' : ''} repris du classeur,`
          + ' avec leurs notes et leurs réponses. Vérifiez les noms et prénoms.',
      })
    } catch (e) {
      setImportInfo({ ok: false, texte: `Classeur non reconnu : ${e.message}` })
    }
  }
  const champFichier = (
    <input ref={fichier} type="file" hidden
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      onChange={e => { importer(e.target.files?.[0]); e.target.value = '' }} />
  )
  const message = importInfo && (
    <p className={`cr-import-info${importInfo.ok ? '' : ' cr-import-info--ko'}`} role="status">
      {importInfo.texte}
      <button type="button" className="cr-import-fermer" aria-label="Masquer"
        onClick={() => setImportInfo(null)}>×</button>
    </p>
  )

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
          <span className="cr-echappee-ou">ou</span>
          <button type="button" className="cr-echappee-lien cr-echappee-lien--second"
            onClick={() => fichier.current?.click()}
            title="Formation, dates, stagiaires, notes et satisfaction, repris d’un classeur .xlsx">
            partir d’un classeur d’évaluation
          </button>
          {champFichier}
        </div>
        {message}
      </div>
    )
  }

  // ── Saisie manuelle
  if (mode === 'manuel') {
    return (
      <div className="cr-panel cr-panel--formulaire">
        <div className="cr-panel-head cr-panel-head--actions">
          <div className="cr-panel-head-texte">
            <h2 className="cr-panel-title">Les informations de la formation</h2>
            <p className="cr-panel-hint">
              Renseignez ce que vous savez. L’intitulé et le nombre de
              participants suffisent pour commencer.
            </p>
          </div>
          <button type="button" className="cr-btn cr-btn--ghost cr-export cr-import"
            onClick={() => fichier.current?.click()}
            title="Reprendre formation, stagiaires, notes et satisfaction d’un classeur d’évaluation (.xlsx)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
              <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            Importer
          </button>
          {champFichier}
        </div>
        {message}

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
    <div className="cr-panel cr-panel--fiche">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Vérifiez les informations</h2>
        <p className="cr-panel-hint">
          Tout vient du planning. Décochez les absents, ajoutez un
          participant non inscrit si besoin.
        </p>
      </div>

      {/* L'intitule porte l'identite de la session : il est le titre,
          pas une colonne parmi cinq. Le reste sont des attributs, de
          longueur comparable, alignes sur une seule ligne. */}
      <div className="cr-fiche">
        <div className="cr-fiche-tete">
          <h3 className="cr-fiche-titre">{brouillon.intitule}</h3>
          {brouillon.codeFormation && (
            <span className="cr-fiche-code">{brouillon.codeFormation}</span>
          )}
        </div>
        <dl className="cr-fiche-attributs">
          <Attribut cle="Période"
            valeur={periodeLongue(brouillon.debut, brouillon.fin)} />
          <Attribut cle="Lieu" valeur={brouillon.lieu} />
          <Attribut cle="Marque" valeur={brouillon.marque} />
          <Attribut cle="Pays" valeur={brouillon.pays} />
        </dl>
      </div>

      <ListeParticipants brouillon={brouillon} maj={maj} />
    </div>
  )
}

function Attribut({ cle, valeur }) {
  if (!valeur) return null
  return (
    <div className="cr-fiche-attribut">
      <dt className="cr-fiche-cle">{cle}</dt>
      <dd className="cr-fiche-val">{valeur}</dd>
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
