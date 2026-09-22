import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import useSiteEffects from '../../hooks/useSiteEffects'
import { SESSIONS_FORMATEUR } from '../../data/mock_sessions_formateur'
import { syntheseGroupe } from '../../utils/baremeCfao'
import { enregistrer, recuperer } from '../../utils/brouillonsCompteRendu'
import { nombreDeJours } from '../../utils/compteRendu'
import PhaseSession from '../../components/compte-rendu/PhaseSession'
import PhaseResultats from '../../components/compte-rendu/PhaseResultats'
import PhaseVerification from '../../components/compte-rendu/PhaseVerification'
import '../../styles/compte-rendu.css'

/**
 * Redaction d'un compte rendu, en trois phases.
 *
 *   1. **La session** — reprise du planning, ou saisie manuelle quand
 *      la formation n'y figure pas.
 *   2. **Les résultats** — notes brutes et appreciations. Tous les
 *      pourcentages se calculent, comme dans les classeurs.
 *   3. **La vérification** — le rapport est deja composable : on le
 *      montre, le formateur ajoute ses photos, choisit les
 *      dispositions et corrige les textes a meme l'apercu.
 *
 * Trois phases, pas neuf etapes. Un decoupage fin rassure celui qui
 * concoit ; il decourage celui qui doit tout remplir un vendredi soir.
 */
const PHASES = [
  { cle: 'session', titre: 'La session', resume: 'Formation, dates, participants' },
  { cle: 'resultats', titre: 'Les résultats', resume: 'Notes et appréciations' },
  { cle: 'verification', titre: 'Vérification', resume: 'Photos, mise en page, aperçu' },
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

  // Le brouillon est enregistre a chaque changement : une saisie de
  // notes pour douze participants ne doit pas se perdre.
  useEffect(() => {
    const id = brouillon.sessionId || (brouillon.manuel ? 'manuel' : null)
    if (id) enregistrer(id, { ...brouillon, phase })
  }, [brouillon, phase])

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

  const maj = patch => setBrouillon(b => ({ ...b, ...patch }))

  function aller(i) {
    setPhase(Math.max(0, Math.min(i, PHASES.length - 1)))
    haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pret = phase === 0
    ? Boolean(session?.moduleFormation && brouillon.participants.length)
    : true

  return (
    <>
      <Nav />
      <main className="portal-page">
        <header className="cr-home-header cr-home-header--slim" ref={haut}>
          <div className="container" style={{ padding: '26px 32px 20px' }}>
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

        <section>
          <div className="container" style={{ padding: '26px 32px 56px' }}>
            {phase === 0 && (
              <PhaseSession
                brouillon={brouillon} maj={maj}
                sessions={SESSIONS_FORMATEUR}
                onChoisirSession={s => setBrouillon(depuisSession(s))}
                onSaisieManuelle={() => setBrouillon({
                  ...brouillonVide(), manuel: true, participants: [],
                })}
              />
            )}
            {phase === 1 && (
              <PhaseResultats
                brouillon={brouillon} maj={maj}
                session={session} synthese={synthese}
              />
            )}
            {phase === 2 && (
              <PhaseVerification
                brouillon={brouillon} maj={maj}
                session={session} synthese={synthese}
                onTerminer={() => naviguer('/portail/formateur')}
              />
            )}

            {phase < 2 && (
              <div className="cr-actions">
                <button type="button" className="cr-btn cr-btn--ghost"
                  onClick={() => phase === 0 ? naviguer('/portail/formateur') : aller(phase - 1)}>
                  ← {phase === 0 ? 'Annuler' : 'Retour'}
                </button>
                <div className="cr-actions-right">
                  {phase === 1 && !synthese.complet && synthese.saisis > 0 && (
                    <span className="cr-actions-info">
                      {synthese.saisis} résultat{synthese.saisis > 1 ? 's' : ''} sur {synthese.effectif}
                    </span>
                  )}
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={() => aller(phase + 1)} disabled={!pret}>
                    {phase === 1 ? 'Voir le rapport →' : 'Continuer →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
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
