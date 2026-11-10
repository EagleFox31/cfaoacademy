import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useEnHautDePage from '../hooks/useEnHautDePage'
import useSiteEffects from '../hooks/useSiteEffects'
import { useAuth } from '../lib/auth'
import useSessionsFormateur from '../hooks/useSessionsFormateur'
import { FILTRES_VIDES, chargerSession, trouverSession } from '../data/sessionsReferentiel'
import { syntheseGroupe, seuilDe } from '../utils/baremeCfao'
import { estCertification, syntheseCertification } from '../utils/certification'
import {
  adopter, enregistrer, garder, inchangeDepuis, recuperer, recupererDuServeur, surveiller, surveillerRefus,
  surveillerReprise,
} from '../utils/brouillonsCompteRendu'
import {
  brouillonVide, depuisSession, estSessionReferentiel, sessionDepuisBrouillon,
} from '../utils/brouillonSession'
import PhaseSession from '../components/compte-rendu/PhaseSession'
import PhaseResultats from '../components/compte-rendu/PhaseResultats'
import PhaseStructure from '../components/compte-rendu/PhaseStructure'
import PhaseVerification from '../components/compte-rendu/PhaseVerification'
import '../styles/compte-rendu.css'

/**
 * Redaction d'un compte rendu, en quatre etapes.
 *
 *   1. **La session** — reprise du planning, ou saisie manuelle quand
 *      la formation n'y figure pas.
 *   2. **Les résultats** — notes brutes et appreciations. Tous les
 *      pourcentages se calculent, comme dans les classeurs.
 *   3. **La structure** — quelles parties composeront le document. Les
 *      cinq presentes dans plus de 90 % des rapports sont acquises ;
 *      les quatre autres se decident session par session.
 *   4. **L'édition** — le rapport est alors composable : on le montre,
 *      le formateur ajoute ses photos, choisit les dispositions et
 *      corrige les textes a meme l'apercu.
 *
 * Quatre etapes, pas neuf. Choisir la structure avant de composer evite
 * de produire des pages qu'il faudrait ensuite retirer une a une.
 */
// Les mots du formateur, pas ceux de l'outil : chaque etape se nomme par
// ce qu'on y fait.
const PHASES = [
  { cle: 'session', titre: 'La formation', resume: 'Formation, participants' },
  { cle: 'resultats', titre: 'Les notes', resume: 'Tests et satisfaction' },
  { cle: 'structure', titre: 'Les pages', resume: 'Choisir les pages' },
  { cle: 'edition', titre: 'Compléter', resume: 'Remplir, puis terminer' },
]

/** Libelle du bouton qui mene a l'etape suivante : il dit ou l'on va. */
const VERS_SUIVANTE = ['Passer aux notes →', 'Passer au choix des pages →', 'Passer aux pages →']

export default function TrainerReportNew() {
  useEnHautDePage('Nouveau compte rendu')
  useSiteEffects()
  const naviguer = useNavigate()
  // Liste d'ou l'assistant a ete ouvert ; a defaut, l'accueil des comptes rendus.
  const depuis = useLocation().state?.depuis || { chemin: '/', libelle: 'Mes comptes rendus' }
  const [params] = useSearchParams()
  const sessionDemandee = params.get('session')
  const { user } = useAuth()
  // Recherche et filtres de la liste : le service les applique.
  const [filtres, setFiltres] = useState(FILTRES_VIDES)
  const liste = useSessionsFormateur(user, filtres)
  const { sessions } = liste

  const [brouillon, setBrouillon] = useState(() => {
    if (sessionDemandee) {
      const repris = recuperer(sessionDemandee)
      if (repris) return repris
    }
    return brouillonVide()
  })
  const [phase, setPhase] = useState(brouillon.phase || 0)
  const haut = useRef(null)

  // Sans formation a proposer, la saisie s'ouvre d'elle-meme : revenir
  // au choix n'aurait plus de sens, le retour ramene donc au tableau de bord.
  const [sansListe, setSansListe] = useState(false)
  const saisieManuelle = useCallback(() => setBrouillon({
    ...brouillonVide(), manuel: true, participants: [],
    // Un id propre a cette saisie : sans lui, toutes les
    // saisies manuelles partageaient la cle 'manuel' et
    // s'ecrasaient l'une l'autre dans le stockage local.
    sessionId: `manuel-${Date.now()}`,
  }), [])
  const listeVide = useCallback(() => {
    setSansListe(true)
    saisieManuelle()
  }, [saisieManuelle])

  // Le brouillon a peut-etre avance sur un autre poste : on demande au
  // serveur sa version avant tout enregistrement — sinon la copie de ce
  // navigateur, re-enregistree a l'ouverture, passerait pour la derniere.
  const [erreurOuverture, setErreurOuverture] = useState(null)
  const synchro = useRef(!sessionDemandee)
  useEffect(() => {
    if (!sessionDemandee) return undefined
    let actif = true
    recupererDuServeur(sessionDemandee).then(async distant => {
      if (!actif) return
      // Monte deux fois (mode strict), la page a deja range ici la
      // version du serveur au premier appel : le second, seul ecoute,
      // la trouve dans ce navigateur et non plus sur le serveur. Sans
      // cela, un lien ouvert sur un poste neuf montrait une page vide.
      let b = distant || (!dernier.current.brouillon.modifieLe && recuperer(sessionDemandee))
      // Ni brouillon ici ni sur le serveur : le compte rendu part de la
      // session, d'ou qu'elle vienne (referentiel ou planning d'essai).
      if (!b && !dernier.current.brouillon.sessionId) {
        try {
          const s = await trouverSession(sessionDemandee, user)
          if (s) b = depuisSession(s)
          else setErreurOuverture('Cette session est introuvable : choisissez-la dans la liste.')
        } catch (e) {
          setErreurOuverture(e?.message || 'La session ne se charge pas.')
        }
        if (!actif) return
      }
      if (b) {
        setBrouillon(b)
        setPhase(b.phase || 0)
      }
      synchro.current = true
    })
    return () => { actif = false }
  }, [sessionDemandee])

  // Le brouillon est garde en reference pour etre enregistre sans que
  // l'effet ait a dependre de son contenu : sinon chaque frappe dans
  // une case de note declenche une ecriture.
  const dernier = useRef({ brouillon, phase })
  dernier.current = { brouillon, phase }

  // Heure du dernier enregistrement, montree au formateur : le savoir
  // enregistre lui permet de quitter la page sans crainte.
  const [enregistreA, setEnregistreA] = useState(null)

  // Le meme compte rendu modifie ailleurs — autre onglet, autre poste —
  // depuis que cette page l'a ouvert : la version la plus recente, tant
  // que le formateur n'a pas choisi. D'ici la, rien ne s'enregistre.
  const [conflit, setConflit] = useState(null)
  const enConflit = useRef(null)
  enConflit.current = conflit
  const idCourant = brouillon.sessionId || (brouillon.manuel ? 'manuel' : null)
  useEffect(() => {
    setConflit(null)
    return surveiller(idCourant, setConflit)
  }, [idCourant])

  // Un envoi refuse par le service (stagiaire hors session, droit
  // manquant) : dit clairement, la saisie reste dans ce navigateur.
  const [refus, setRefus] = useState(null)
  useEffect(() => {
    setRefus(null)
    return surveillerRefus(idCourant, setRefus)
  }, [idCourant])

  // Un envoi accepte que le serveur a corrige (formation, dates, stagiaires
  // du referentiel) : l'ecran montre la version corrigee, sauf si le
  // formateur a tape depuis l'envoi : sa frappe partira au prochain envoi.
  useEffect(() => surveillerReprise(idCourant, (reprise, envoye) => {
    const { brouillon: b, phase: p } = dernier.current
    if (!inchangeDepuis({ ...b, phase: p }, envoye)) return
    const { phase: _p, ...contenu } = reprise
    setBrouillon(contenu)
  }), [idCourant])

  const sauver = useCallback(() => {
    if (!synchro.current || enConflit.current) return
    const { brouillon: b, phase: p } = dernier.current
    const id = b.sessionId || (b.manuel ? 'manuel' : null)
    if (id && enregistrer(id, { ...b, phase: p })) setEnregistreA(new Date())
  }, [])

  function reprendreLaPlusRecente() {
    const v = adopter(idCourant, conflit)
    setConflit(null)
    setBrouillon(v)
    setPhase(v.phase || 0)
  }

  function garderCetteVersion() {
    garder(idCourant, { ...brouillon, phase }, conflit)
    setConflit(null)
    setEnregistreA(new Date())
  }

  // Aux moments qui comptent : changement d'etape, et depart de la page
  // (onglet ferme, navigation). Entre les deux, les volets de saisie
  // appellent `sauver` quand on passe de l'un a l'autre.
  useEffect(() => { sauver() }, [phase, sauver])

  // Filet de securite : une frappe non suivie d'un changement d'etape
  // (fermeture d'onglet sans clic sur « Continuer », onglet tue plutot
  // que ferme proprement) ne declenchait alors aucune ecriture — des
  // notes saisies pouvaient disparaitre sans avoir jamais atteint le
  // stockage. Un court differe apres chaque modification couvre ce cas
  // sans ecrire a chaque caractere tape.
  useEffect(() => {
    const minuteur = setTimeout(sauver, 1500)
    return () => clearTimeout(minuteur)
  }, [brouillon, sauver])

  useEffect(() => {
    window.addEventListener('beforeunload', sauver)
    return () => {
      window.removeEventListener('beforeunload', sauver)
      sauver()
    }
  }, [sauver])

  // Une session du referentiel absente de la liste (filtres, lien direct)
  // se demande au service : son code et son formateur n'ont pas d'autre source.
  const [sessionApi, setSessionApi] = useState(null)
  const lieeAuReferentiel = !brouillon.manuel && estSessionReferentiel(brouillon.sessionId)
  const dansLaListe = lieeAuReferentiel && sessions.some(s => s.id === brouillon.sessionId)
  useEffect(() => {
    if (!lieeAuReferentiel || dansLaListe) return undefined
    let actif = true
    chargerSession(brouillon.sessionId)
      .then(s => { if (actif && s) setSessionApi(s) })
      .catch(() => {})
    return () => { actif = false }
  }, [lieeAuReferentiel, dansLaListe, brouillon.sessionId])

  const session = useMemo(() => {
    if (brouillon.manuel) return sessionDepuisBrouillon(brouillon)
    const connue = sessions.find(s => s.id === brouillon.sessionId)
      || (sessionApi?.id === brouillon.sessionId ? sessionApi : null)
    return lieeAuReferentiel ? sessionDepuisBrouillon(brouillon, connue) : connue || null
  }, [brouillon, sessions, sessionApi, lieeAuReferentiel])

  const certification = estCertification(brouillon)
  const synthese = useMemo(
    () => (certification
      ? syntheseCertification(brouillon.participants, brouillon.modules, seuilDe(brouillon))
      : syntheseGroupe(brouillon.participants, brouillon.baremes, seuilDe(brouillon))),
    [certification, brouillon.participants, brouillon.modules, brouillon.baremes, brouillon.seuil],
  )

  // Un patch, ou une fonction de l'etat courant quand la modification
  // arrive apres un appel reseau : elle se compose alors avec ce qui a
  // ete saisi entre-temps au lieu de l'ecraser.
  const maj = useCallback(patch => setBrouillon(b => ({
    ...b, ...(typeof patch === 'function' ? patch(b) : patch),
  })), [])

  // Quitter les notes incompletes se fait en connaissance de cause : sans
  // notes, les pages de resultats et les fiches sortent vides, et on ne
  // le decouvrait qu'a la fin.
  const [alerteNotes, setAlerteNotes] = useState(false)
  const notesManquantes = synthese.effectif - synthese.saisis

  function suivant() {
    if (phase === 1 && notesManquantes > 0 && !alerteNotes) {
      setAlerteNotes(true)
      return
    }
    aller(phase + 1)
  }

  // Une session deja commencee reprend son brouillon, d'ici ou du
  // serveur ; aucun enregistrement avant la reponse du serveur, pour ne
  // pas ecraser sa copie par une page blanche.
  function reprendreOuCommencer(s) {
    synchro.current = false
    const local = recuperer(s.id)
    setBrouillon(local || depuisSession(s))
    recupererDuServeur(s.id).then(distant => {
      if (distant) setBrouillon(distant)
      synchro.current = true
    })
  }

  function aller(i) {
    setAlerteNotes(false)
    setPhase(Math.max(0, Math.min(i, PHASES.length - 1)))
    haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pret = phase === 0
    ? Boolean(session?.moduleFormation && brouillon.participants.length)
    : true

  // Le retour suit la profondeur reelle : a la premiere phase, une
  // session engagee se quitte d'abord vers la liste, et seule la liste
  // vide ramene au tableau de bord.
  const engage = Boolean(brouillon.sessionId || brouillon.manuel) && !sansListe
  const libelleRetour = phase > 0 ? 'Retour'
    : engage ? 'Changer de formation' : 'Annuler'

  function retourner() {
    if (phase > 0) return aller(phase - 1)
    if (engage) return setBrouillon(brouillonVide())
    naviguer(depuis.chemin)
  }

  return (
    <>
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim" ref={haut}>
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer(depuis.chemin)}>
              ← {depuis.libelle}
            </button>
            <h1 className="cr-home-title cr-home-title--sm">
              {session?.moduleFormation || 'Nouveau compte rendu'}
            </h1>
            <div className="cr-phases-ligne">
              <div className="cr-phases" role="tablist" aria-label="Phases">
                {PHASES.map((p, i) => (
                  <button key={p.cle} type="button" role="tab"
                    aria-selected={i === phase}
                    className={`cr-phase${i === phase ? ' cr-phase--on' : ''}`
                      + `${i < phase ? ' cr-phase--done' : ''}`}
                    onClick={() => i <= phase && aller(i)}
                    disabled={i > phase && !pret}>
                    <span className="cr-phase-num">{i < phase ? '✓' : i + 1}</span>
                    <span className="cr-phase-texte">
                      <span className="cr-phase-titre">{p.titre}</span>
                      <span className="cr-phase-resume">
                        {certification && p.cle === 'resultats' ? 'Modules et satisfaction' : p.resume}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {enregistreA && !conflit && (
                <p className="cr-enregistre" role="status">
                  ✓ Enregistré à {enregistreA.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            {conflit && (
              <div className="cr-alerte" role="alert">
                <p className="cr-alerte-texte">
                  <strong>Ce compte rendu a été modifié ailleurs</strong>
                  {conflit.modifieLe && ` à ${new Date(conflit.modifieLe)
                    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`}
                  {' '}— dans un autre onglet ou sur un autre poste. Ce qui est affiché ici est
                  une copie plus ancienne : rien ne s’enregistre tant que vous n’avez pas choisi.
                </p>
                <div className="cr-alerte-actions">
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={reprendreLaPlusRecente}>
                    Reprendre la version la plus récente
                  </button>
                  <button type="button" className="cr-btn cr-btn--ghost"
                    onClick={garderCetteVersion}>
                    Garder celle de cet onglet
                  </button>
                </div>
              </div>
            )}
            {refus && (
              <div className="cr-alerte" role="alert">
                <p className="cr-alerte-texte">
                  <strong>Ce compte rendu n’est pas enregistré sur le serveur.</strong> {refus}
                </p>
              </div>
            )}
            {erreurOuverture && (
              <div className="cr-alerte" role="alert">
                <p className="cr-alerte-texte">{erreurOuverture}</p>
              </div>
            )}
            {phase === 0 && (
              <PhaseSession
                brouillon={brouillon} maj={maj}
                liste={liste} filtres={filtres} onFiltres={setFiltres} user={user}
                onChoisirSession={reprendreOuCommencer}
                onSaisieManuelle={saisieManuelle}
                onListeVide={listeVide}
              />
            )}
            {phase === 1 && (
              <PhaseResultats
                brouillon={brouillon} maj={maj}
                session={session} synthese={synthese}
                onEnregistrer={sauver}
              />
            )}
            {phase === 2 && (
              <PhaseStructure
                brouillon={brouillon} maj={maj}
                session={session} synthese={synthese}
              />
            )}
            {phase === 3 && (
              <PhaseVerification
                brouillon={brouillon} maj={maj}
                session={session} synthese={synthese}
                onTerminer={() => naviguer('/')}
              />
            )}

            {alerteNotes && (
              <div className="cr-alerte" role="alert">
                <p className="cr-alerte-texte">
                  <strong>Il manque les notes de {notesManquantes} stagiaire{notesManquantes > 1 ? 's' : ''}.</strong>
                  {' '}Sans notes, la page des résultats et les fiches des stagiaires seront vides.
                </p>
                <div className="cr-alerte-actions">
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={() => setAlerteNotes(false)}>
                    Saisir les notes
                  </button>
                  <button type="button" className="cr-btn cr-btn--ghost"
                    onClick={() => aller(phase + 1)}>
                    Continuer quand même
                  </button>
                </div>
              </div>
            )}

            {phase < PHASES.length - 1 && (
              <div className="cr-actions">
                <button type="button" className="cr-btn cr-btn--ghost"
                  onClick={retourner}>
                  ← {libelleRetour}
                </button>
                <div className="cr-actions-right">
                  {/* Un bouton grise dit toujours pourquoi. */}
                  {!pret && (
                    <span className="cr-actions-info">
                      {session?.moduleFormation
                        ? 'Cochez au moins un stagiaire présent'
                        : 'Choisissez d’abord une formation'}
                    </span>
                  )}
                  {phase === 1 && !synthese.complet && (
                    <span className="cr-actions-info">
                      Notes saisies : {synthese.saisis} stagiaire{synthese.saisis > 1 ? 's' : ''} sur {synthese.effectif}
                    </span>
                  )}
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={suivant} disabled={!pret}>
                    {VERS_SUIVANTE[phase]}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
