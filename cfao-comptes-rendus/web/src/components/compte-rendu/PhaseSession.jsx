import { useCallback, useEffect, useState } from 'react'
import { periodeLongue } from '../../utils/compteRendu'
import CarteCompteRendu, { BadgeCompteRendu, carteDeSession } from './CarteCompteRendu'
import Consigne from './Consigne'
import RepriseStagiaires from './RepriseStagiaires'
import { brouillonsEnregistres, estTermine, synchroniser } from '../../utils/brouillonsCompteRendu'
import { CERTIFICATION, FORMATION, champsDeType, estCertification } from '../../utils/certification'

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
 *
 * La page se remplit en deux volets, comme celle des notes, un seul
 * ouvert a la fois : la formation d'abord — son type compris, qui
 * decide de toute la suite —, puis les participants.
 */
export default function PhaseSession({
  brouillon, maj, sessions, onChoisirSession, onSaisieManuelle, onListeVide,
}) {
  // Le mode se deduit du brouillon : l'orchestrateur porte le bouton de
  // retour dans sa barre fixe, et doit pouvoir revenir au choix sans
  // qu'un etat local vienne le contredire.
  const mode = brouillon.manuel ? 'manuel'
    : brouillon.sessionId ? 'planning' : null

  // Deux volets, un seul ouvert : on termine la formation avant de
  // passer aux participants.
  const [volet, setVolet] = useState('formation')

  // Une session du planning peut etre fausse ou incomplete (dates,
  // lieu, un stagiaire mal orthographie) : « Modifier » l'ouvre dans le
  // formulaire de la saisie libre, stagiaires compris.
  const [edition, setEdition] = useState(false)
  const saisie = mode === 'manuel' || edition

  // Les informations retouchees (dates, lieu, stagiaires) font du compte
  // rendu une saisie a enregistrer, meme sans note : le planning n'en est
  // pas modifie, seul ce compte rendu les garde.
  const majInfos = useCallback(patch => maj(b => ({
    ...(typeof patch === 'function' ? patch(b) : patch), infosModifiees: true,
  })), [maj])

  // Les comptes rendus deja commences, ici ou sur un autre poste : la
  // liste des formations dit ou en est chacune, pas seulement le
  // planning. Cliquer une formation commencee la reprend.
  const [commences, setCommences] = useState(() => (mode ? [] : brouillonsEnregistres()))
  const [synchronise, setSynchronise] = useState(false)
  useEffect(() => {
    if (mode) return undefined
    let actif = true
    synchroniser()
      .then(liste => { if (actif && liste) setCommences(liste) })
      .catch(() => {})
      .finally(() => { if (actif) setSynchronise(true) })
    return () => { actif = false }
  }, [mode])

  // La session choisie apporte son type (d'apres son code) et ses
  // stagiaires : le type ne se corrige qu'ensuite, dans le volet.
  const choisir = s => onChoisirSession(s)
  const passerEnManuel = () => onSaisieManuelle()
  const type = estCertification(brouillon) ? CERTIFICATION : FORMATION
  function choisirType(t) {
    if (t === type) return
    maj(t === CERTIFICATION && (brouillon.modules || []).length
      ? { type: t }
      : champsDeType(t, brouillon.codeFormation))
  }
  const participants = brouillon.participants || []
  const presents = participants.filter(p => p.present !== false).length

  // Un compte rendu termine n'est plus a faire : sa formation quitte la
  // liste et se retrouve dans « Mes comptes rendus ». Une session deja
  // documentee au planning n'y revient que si une saisie la reprend.
  const proposables = sessions.filter(s => {
    if (s.statut === 'a_venir') return false
    const b = commences.find(x => x.id === s.id)
    if (estTermine(b)) return false
    return s.statut !== 'termine' || !!b
  })

  // Aucune formation a proposer : une liste vide n'apprend rien, la
  // saisie s'ouvre directement. On attend la synchronisation, qui peut
  // ramener une formation commencee sur un autre poste.
  const listeVide = !mode && synchronise && proposables.length === 0
  useEffect(() => {
    if (listeVide) onListeVide()
  }, [listeVide, onListeVide])

  // ── Le volet de la formation : le type, puis la formation elle-meme
  let formation
  if (!mode) {
    formation = (
      <>
        <div className="cr-session-grid">
          {proposables.map(s => {
            const commence = commences.find(b => b.id === s.id)
            return (
              <CarteCompteRendu key={s.id} carte={carteDeSession(s)} onClick={() => choisir(s)}
                badge={<BadgeCompteRendu phase={commence?.phase}
                  etat={commence ? 'en_cours_redaction'
                    : s.statut === 'a_rediger' ? 'a_rediger'
                      : s.statut === 'en_cours' ? 'session_en_cours' : null} />} />
            )
          })}
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
      </>
    )
  } else if (saisie) {
    formation = (
      <div className="cr-form">
        {/* Une ligne par nature d'information : ce qui identifie la
            formation, quand elle a eu lieu, ou et avec combien de
            personnes. */}
        <div className="cr-form-ligne cr-form-ligne--code-intitule">
          <Champ label="Code" valeur={brouillon.codeFormation}
            surSaisie={v => majInfos({ codeFormation: v })} exemple="Exemple : TS05-G3" />
          <Champ label="Intitulé de la formation"
            valeur={brouillon.intitule}
            surSaisie={v => majInfos({ intitule: v })}
            exemple="Exemple : Révision et réparation des organes châssis" />
        </div>

        <div className="cr-form-ligne cr-form-ligne--trois">
          <Champ label="Marque" valeur={brouillon.marque}
            surSaisie={v => majInfos({ marque: v })} exemple="Exemple : TOYOTA" />
          <Champ label="Début" type="date" valeur={brouillon.debut}
            surSaisie={v => majInfos({ debut: v })} />
          <Champ label="Fin" type="date" valeur={brouillon.fin}
            surSaisie={v => majInfos({ fin: v })} />
        </div>

        <div className="cr-form-ligne cr-form-ligne--trois">
          <Champ label="Lieu" valeur={brouillon.lieu}
            surSaisie={v => majInfos({ lieu: v })}
            exemple="Exemple : Centre CFAO Academy, Douala" />
          <Champ label="Pays" valeur={brouillon.pays}
            surSaisie={v => majInfos({ pays: v })} exemple="Exemple : Cameroun" />
          <ChampEffectif brouillon={brouillon} maj={majInfos} />
        </div>
      </div>
    )
  } else {
    // L'intitule porte l'identite de la session : il est le titre, pas
    // une colonne parmi cinq. Le reste sont des attributs, de longueur
    // comparable, alignes sur une seule ligne.
    formation = (
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
    )
  }

  // ── Rien d'engage : la liste des formations, seule. Une session du
  // planning porte deja son type et ses stagiaires.
  if (!mode) {
    // Pendant la synchronisation, une liste vide ne s'affiche pas : elle
    // laisserait voir une page sans formation juste avant la saisie.
    if (!synchronise && proposables.length === 0) return null
    return (
      <div className="cr-panel cr-panel--choix">
        <Consigne faire="Cliquez sur la formation de ce compte rendu."
          ensuite="Puis : vérifiez la formation et ses participants. Ensuite : les notes." />
        {formation}
      </div>
    )
  }

  // Le titre annonce les deux volets de l'etape ; la ligne dessous suit
  // le volet ouvert, puis nomme la suite, comme a l'etape des notes.
  const consigne = ['Renseignez les informations de la formation et des participants.',
    volet === 'formation'
      ? 'D’abord la formation. Puis : les participants, juste en dessous. Ensuite : les notes.'
      : saisie
        ? 'Nom, pays et fonction de chaque stagiaire. Ensuite : les notes.'
        : 'Décochez les absents, ajoutez ceux qui manquent. Ensuite : les notes.']

  return (
    <div className={`cr-panel ${mode === 'manuel' ? 'cr-panel--formulaire' : 'cr-panel--fiche'}`}>
      <Consigne faire={consigne[0]} ensuite={consigne[1]}>
        {mode === 'planning' && (
          <button type="button" className="cr-btn cr-btn--ghost cr-export"
            onClick={() => setEdition(e => !e)}
            title={edition ? 'Revenir à la fiche de la formation'
              : 'Corriger la formation ou les stagiaires dans le formulaire de saisie'}>
            {edition ? '✓ Terminer la modification' : '✎ Modifier les informations'}
          </button>
        )}
      </Consigne>

      <div className="cr-blocs cr-blocs--etape1">
        <Bloc titre="1. Formation"
          resume={brouillon.codeFormation || 'Saisie libre'}
          valeur={libelleType(type)} ton="ok"
          ouvert={volet === 'formation'} onOuvrir={() => setVolet('formation')}>
          <div className="cr-baremes cr-type-cadre">
            <span className="cr-baremes-label">Type de compte rendu</span>
            <ChoixType valeur={type} onChoisir={choisirType} />
          </div>
          {formation}
          <SuiteVolet onClick={() => setVolet('participants')}>
            Passer aux participants
          </SuiteVolet>
        </Bloc>

        <Bloc titre="2. Participants"
          resume={`${participants.length} stagiaire${participants.length > 1 ? 's' : ''}`}
          valeur={`${presents} présent${presents > 1 ? 's' : ''}`}
          ton={presents ? 'ok' : null}
          ouvert={volet === 'participants'}
          onOuvrir={() => setVolet('participants')}>
          <ListeParticipants brouillon={brouillon} maj={majInfos} modifiable={saisie} />
        </Bloc>
      </div>
    </div>
  )
}

/** Le passage au volet suivant, la ou l'on arrive en finissant celui-ci. */
function SuiteVolet({ onClick, children }) {
  return (
    <div className="cr-suite-volet">
      <button type="button" className="cr-btn cr-btn--ghost" onClick={onClick}>
        {children} ↓
      </button>
    </div>
  )
}

/** Un volet depliable, ouvert ou non selon le parent : le meme qu'a l'etape des notes. */
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

const TYPES = [
  [FORMATION, 'Formation',
    'Test d’entrée, théorie finale et pratique, notés selon un barème.'],
  [CERTIFICATION, 'Certification',
    'Modules pratiques notés sur 100, et e-learning à valider.'],
]
const libelleType = type => TYPES.find(([t]) => t === type)?.[1] || ''

/**
 * Formation ou certification.
 *
 * Deux boutons radio plutot que deux cartes : le choix tient sur une
 * ligne, et chacun dit comment les stagiaires sont evalues — c'est ce
 * que le formateur sait sans hesiter. Une session du planning arrive
 * deja reglee d'apres son code ; le choix reste visible pour corriger.
 */
function ChoixType({ valeur, onChoisir }) {
  return (
    <div className="cr-type-radios" role="radiogroup" aria-label="Type de compte rendu">
      {TYPES.map(([type, libelle, description]) => (
        <label key={type} className="cr-radio">
          <input type="radio" name="type-compte-rendu" value={type}
            checked={valeur === type} onChange={() => onChoisir(type)} />
          <span>
            <span className="cr-radio-libelle">{libelle}</span>
            <small>{description}</small>
          </span>
        </label>
      ))}
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
      <span className="cr-field-label">Nombre de stagiaires</span>
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

/**
 * Prenom et nom d'une saisie « Prénom NOM » : les mots en capitales
 * forment le nom, les autres le prenom — l'usage des feuilles de
 * presence. Sans capitales, le dernier mot est le nom.
 */
function decouperNom(texte) {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  const capitales = mots.filter(m => m.length > 1 && m === m.toUpperCase() && m !== m.toLowerCase())
  if (capitales.length && capitales.length < mots.length) {
    return {
      prenom: mots.filter(m => !capitales.includes(m)).join(' '),
      nom: capitales.join(' '),
    }
  }
  if (capitales.length || mots.length < 2) return { prenom: '', nom: mots.join(' ') }
  return { prenom: mots.slice(0, -1).join(' '), nom: mots[mots.length - 1] }
}

const motsTries = t => t.trim().split(/\s+/).sort().join(' ')
const memesMots = (a, b) => motsTries(a) === motsTries(b)

/**
 * Le nom complet d'un stagiaire, en un seul champ.
 *
 * Le texte tape reste tel quel pendant la saisie ; prenom et nom en
 * sont tires a chaque frappe. Une valeur venue d'ailleurs — reprise,
 * import — remplace le texte.
 */
function ChampNomComplet({ p, onChange }) {
  const complet = `${p.prenom || ''} ${p.nom || ''}`.trim()
  const [texte, setTexte] = useState(complet)
  useEffect(() => {
    if (!memesMots(texte, complet)) setTexte(complet)
  // Seule une valeur exterieure doit ecraser la saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complet])
  return (
    <input className="cr-input cr-input--nom" placeholder="Prénom NOM"
      value={texte}
      onChange={e => { setTexte(e.target.value); onChange(decouperNom(e.target.value)) }} />
  )
}

/** La liste des stagiaires, en lecture ou en saisie. */
function ListeParticipants({ brouillon, maj, modifiable }) {
  const participants = brouillon.participants || []

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

  // Les stagiaires repris d'un autre compte rendu prennent d'abord les
  // lignes laissees vides par le nombre de stagiaires, puis s'ajoutent.
  const [reprise, setReprise] = useState(false)
  function reprendre(nouveaux) {
    const reste = [...nouveaux]
    const suite = participants.map(p => (estVide(p) && reste.length ? reste.shift() : p))
    maj({ participants: [...suite, ...reste] })
    setReprise(false)
  }

  return (
    <div className="cr-participants">
      {participants.length === 0 ? (
        <p className="cr-vide-texte">
          Indiquez le nombre de stagiaires dans « 1. Formation » : une
          ligne par stagiaire apparaîtra ici.
        </p>
      ) : (
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>Présent</th>
                <th>Stagiaire</th>
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
                      <ChampNomComplet p={p}
                        onChange={noms => maj({
                          participants: participants.map(x => (x.id === p.id ? { ...x, ...noms } : x)),
                        })} />
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

      <div className="cr-ajouts-stagiaires">
        <button type="button" className="cr-echappee-lien cr-ajout-stagiaire"
          onClick={() => maj({ participants: [...participants, ligneVide(participants.length)] })}>
          + Ajouter un stagiaire
        </button>
        {!reprise && (
          <button type="button" className="cr-echappee-lien cr-ajout-stagiaire"
            onClick={() => setReprise(true)}>
            ↺ Reprendre des stagiaires d’un autre compte rendu
          </button>
        )}
      </div>
      {reprise && (
        <RepriseStagiaires brouillon={brouillon} onAjouter={reprendre}
          onFermer={() => setReprise(false)} />
      )}
    </div>
  )
}
