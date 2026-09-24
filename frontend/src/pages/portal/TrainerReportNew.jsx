import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import useSiteEffects from '../../hooks/useSiteEffects'
import { SESSIONS_FORMATEUR } from '../../data/mock_sessions_formateur'
import { syntheseGroupe } from '../../utils/baremeCfao'
import { enregistrer, recuperer, recupererDuServeur } from '../../utils/brouillonsCompteRendu'
import { nombreDeJours } from '../../utils/compteRendu'
import PhaseSession from '../../components/compte-rendu/PhaseSession'
import PhaseResultats from '../../components/compte-rendu/PhaseResultats'
import PhaseStructure from '../../components/compte-rendu/PhaseStructure'
import PhaseVerification from '../../components/compte-rendu/PhaseVerification'
import '../../styles/compte-rendu.css'

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
const PHASES = [
  { cle: 'session', titre: 'La session', resume: 'Formation, dates, participants' },
  { cle: 'resultats', titre: 'Les résultats', resume: 'Notes et satisfaction' },
  { cle: 'structure', titre: 'La structure', resume: 'Parties du document' },
  { cle: 'edition', titre: 'L’édition', resume: 'Photos, mise en page, aperçu' },
]

function brouillonVide() {
  return {
    sessionId: null,
    manuel: false,
    intitule: '',
    codeFormation: '',
    marque: '',
    lieu: '',
    pays: '',
    debut: '',
    fin: '',
    participants: [],
    photos: {},
    dispositions: {},
    textes: {},
    parties: {},
    satisfaction: {},
    phase: 0,
  }
}

export default function TrainerReportNew() {
  useSiteEffects()
  const naviguer = useNavigate()
  const [params] = useSearchParams()
  const sessionDemandee = params.get('session')

  const [brouillon, setBrouillon] = useState(() => {
    if (sessionDemandee) {
      const repris = recuperer(sessionDemandee)
      if (repris) return repris
      const s = SESSIONS_FORMATEUR.find(x => x.id === sessionDemandee)
      if (s) return depuisSession(s)
    }
    return brouillonVide()
  })
  const [phase, setPhase] = useState(brouillon.phase || 0)
  const haut = useRef(null)

  // Le brouillon a peut-etre avance sur un autre poste : on demande au
  // serveur sa version avant tout enregistrement — sinon la copie de ce
  // navigateur, re-enregistree a l'ouverture, passerait pour la derniere.
  const synchro = useRef(!sessionDemandee)
  useEffect(() => {
    if (!sessionDemandee) return undefined
    let actif = true
    recupererDuServeur(sessionDemandee).then(distant => {
      if (!actif) return
      if (distant) {
        setBrouillon(distant)
        setPhase(distant.phase || 0)
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

  const sauver = useCallback(() => {
    if (!synchro.current) return
    const { brouillon: b, phase: p } = dernier.current
    const id = b.sessionId || (b.manuel ? 'manuel' : null)
    if (id) enregistrer(id, { ...b, phase: p })
  }, [])

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

  const session = useMemo(() => {
    if (brouillon.manuel) {
      return {
        moduleFormation: brouillon.intitule,
        codeFormation: brouillon.codeFormation,
        marque: brouillon.marque,
        lieu: brouillon.lieu,
        paysHote: brouillon.pays,
        debut: brouillon.debut,
        fin: brouillon.fin,
        nbJours: brouillon.nbJours,
      }
    }
    return SESSIONS_FORMATEUR.find(s => s.id === brouillon.sessionId) || null
  }, [brouillon])

  const synthese = useMemo(
    () => syntheseGroupe(brouillon.participants),
    [brouillon.participants],
  )

  // Un patch, ou une fonction de l'etat courant quand la modification
  // arrive apres un appel reseau : elle se compose alors avec ce qui a
  // ete saisi entre-temps au lieu de l'ecraser.
  const maj = useCallback(patch => setBrouillon(b => ({
    ...b, ...(typeof patch === 'function' ? patch(b) : patch),
  })), [])

  function aller(i) {
    setPhase(Math.max(0, Math.min(i, PHASES.length - 1)))
    haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pret = phase === 0
    ? Boolean(session?.moduleFormation && brouillon.participants.length)
    : true

  // Le retour suit la profondeur reelle : a la premiere phase, une
  // session engagee se quitte d'abord vers la liste, et seule la liste
  // vide ramene au tableau de bord.
  const engage = Boolean(brouillon.sessionId || brouillon.manuel)
  const libelleRetour = phase > 0 ? 'Retour'
    : engage ? 'Changer de formation' : 'Annuler'

  function retourner() {
    if (phase > 0) return aller(phase - 1)
    if (engage) return setBrouillon(brouillonVide())
    naviguer('/portail/formateur')
  }

  return (
    <>
      <Nav />
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim" ref={haut}>
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer('/portail/formateur')}>
              ← Mes comptes rendus
            </button>
            <h1 className="cr-home-title cr-home-title--sm">
              {session?.moduleFormation || 'Nouveau compte rendu'}
            </h1>
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
                    <span className="cr-phase-resume">{p.resume}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            {phase === 0 && (
              <PhaseSession
                brouillon={brouillon} maj={maj}
                sessions={SESSIONS_FORMATEUR}
                onChoisirSession={s => setBrouillon(depuisSession(s))}
                onSaisieManuelle={(depart = {}) => setBrouillon({
                  ...brouillonVide(), manuel: true, participants: [],
                  // Un id propre a cette saisie : sans lui, toutes les
                  // saisies manuelles partageaient la cle 'manuel' et
                  // s'ecrasaient l'une l'autre dans le stockage local.
                  sessionId: `manuel-${Date.now()}`,
                  // Ce qu'un classeur d'evaluation importe a deja rempli.
                  ...depart,
                })}
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
                onTerminer={() => naviguer('/portail/formateur')}
              />
            )}

            {phase < PHASES.length - 1 && (
              <div className="cr-actions">
                <button type="button" className="cr-btn cr-btn--ghost"
                  onClick={retourner}>
                  ← {libelleRetour}
                </button>
                <div className="cr-actions-right">
                  {phase === 1 && !synthese.complet && synthese.saisis > 0 && (
                    <span className="cr-actions-info">
                      {synthese.saisis} résultat{synthese.saisis > 1 ? 's' : ''} sur {synthese.effectif}
                    </span>
                  )}
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={() => aller(phase + 1)} disabled={!pret}>
                    {phase === 2 ? 'Composer le rapport →' : 'Continuer →'}
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

/** Prepare un brouillon depuis une session du planning. */
function depuisSession(s) {
  return {
    ...brouillonVide(),
    sessionId: s.id,
    intitule: s.moduleFormation,
    codeFormation: s.codeFormation,
    marque: s.marque,
    lieu: s.lieu,
    pays: s.paysHote,
    debut: s.debut,
    fin: s.fin,
    nbJours: nombreDeJours(s),
    participants: s.participants.map(p => ({
      ...p,
      entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
      appreciation: '',
    })),
  }
}
