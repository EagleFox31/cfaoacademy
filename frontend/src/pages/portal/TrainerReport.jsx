import { useMemo, useState, useRef, useEffect } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import useSiteEffects from '../../hooks/useSiteEffects'
import {
  SESSIONS_FORMATEUR,
  SESSION_STATUTS,
  PARTIES_RAPPORT,
  partiesParDefaut,
} from '../../data/mock_sessions_formateur'
import {
  syntheseSession,
  anomaliesSaisie,
  tauxAcquisition,
  nombreDeJours,
  periodeLongue,
  etatEtape,
  dossierSession,
  SEUIL_DEFAUT,
} from '../../utils/compteRendu'
import CrStepper from '../../components/compte-rendu/CrStepper'
import CrChoixSession from '../../components/compte-rendu/CrChoixSession'
import CrParticipants from '../../components/compte-rendu/CrParticipants'
import CrNotes from '../../components/compte-rendu/CrNotes'
import CrParties from '../../components/compte-rendu/CrParties'
import CrDeroule from '../../components/compte-rendu/CrDeroule'
import CrPhotos from '../../components/compte-rendu/CrPhotos'
import CrBilan from '../../components/compte-rendu/CrBilan'
import CrFiches from '../../components/compte-rendu/CrFiches'
import CrRecapitulatif from '../../components/compte-rendu/CrRecapitulatif'
import '../../styles/compte-rendu.css'

/** Les etapes de l'assistant, dans l'ordre.
 *
 * `cle` sert au calcul d'avancement, `titre` est ce que le formateur
 * lit dans le fil. Les etapes « photos » et « fiches » disparaissent du
 * fil quand les parties correspondantes sont ecartees : montrer une
 * etape qu'on va sauter deroute plus qu'elle n'informe.
 */
const ETAPES = [
  { cle: 'session', titre: 'Session' },
  { cle: 'participants', titre: 'Participants' },
  { cle: 'notes', titre: 'Notes' },
  { cle: 'parties', titre: 'Contenu' },
  { cle: 'deroule', titre: 'Déroulé', partie: 'deroule' },
  { cle: 'photos', titre: 'Photos' },
  { cle: 'bilan', titre: 'Bilan', partie: 'bilan' },
  { cle: 'fiches', titre: 'Fiches', partie: 'fiches' },
  { cle: 'recap', titre: 'Génération' },
]

const BROUILLON_VIDE = {
  sessionId: null,
  participants: [],
  parties: partiesParDefaut(),
  jours: {},
  photos: {},
  bilanVu: false,
  bilanValide: false,
  fichesValidees: false,
}

const STOCKAGE = 'cfao.compte-rendu.brouillon'

export default function TrainerReport() {
  useSiteEffects()

  // Le brouillon survit a un rechargement : une saisie de notes pour
  // douze participants ne doit pas se perdre sur un onglet ferme.
  const [brouillon, setBrouillon] = useState(() => {
    try {
      const enregistre = localStorage.getItem(STOCKAGE)
      if (enregistre) return { ...BROUILLON_VIDE, ...JSON.parse(enregistre) }
    } catch {
      /* stockage indisponible : on repart d'un brouillon vide */
    }
    return BROUILLON_VIDE
  })
  const [etape, setEtape] = useState(0)
  const hautRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STOCKAGE, JSON.stringify(brouillon))
    } catch {
      /* rien a faire : le brouillon reste en memoire */
    }
  }, [brouillon])

  const session = useMemo(
    () => SESSIONS_FORMATEUR.find(s => s.id === brouillon.sessionId) || null,
    [brouillon.sessionId],
  )

  // Les etapes reellement affichees, une fois les parties choisies.
  const etapesVisibles = useMemo(
    () => ETAPES.filter(e => !e.partie || brouillon.parties.includes(e.partie)),
    [brouillon.parties],
  )
  const etapeCourante = etapesVisibles[Math.min(etape, etapesVisibles.length - 1)]

  const synthese = useMemo(
    () => syntheseSession(brouillon.participants, session?.seuil ?? SEUIL_DEFAUT),
    [brouillon.participants, session],
  )

  const maj = patch => setBrouillon(b => ({ ...b, ...patch }))

  function choisirSession(s) {
    setBrouillon({
      ...BROUILLON_VIDE,
      sessionId: s.id,
      // On copie les participants : le formateur peut marquer un absent
      // ou corriger un nom sans toucher a la fiche session.
      participants: s.participants.map(p => ({
        ...p, entree: '', sortie: '', theorie: '', pratique: '',
      })),
      jours: Object.fromEntries(
        Array.from({ length: nombreDeJours(s) }, (_, i) => [
          i + 1, { thematiques: [''], forts: [''], ameliorations: [''] },
        ]),
      ),
    })
    setEtape(1)
  }

  function aller(i) {
    setEtape(Math.max(0, Math.min(i, etapesVisibles.length - 1)))
    hautRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const etats = useMemo(() => {
    const out = {}
    for (const e of etapesVisibles) {
      out[e.cle] = e.cle === 'recap' ? 'vide' : etatEtape(e.cle, brouillon, session)
    }
    return out
  }, [etapesVisibles, brouillon, session])

  function rendu() {
    const commun = { brouillon, maj, session, synthese }
    switch (etapeCourante?.cle) {
      case 'session':
        return <CrChoixSession sessions={SESSIONS_FORMATEUR} statuts={SESSION_STATUTS}
          choisi={brouillon.sessionId} onChoisir={choisirSession} />
      case 'participants':
        return <CrParticipants {...commun} />
      case 'notes':
        return <CrNotes {...commun} anomalies={anomaliesSaisie} calcul={tauxAcquisition} />
      case 'parties':
        return <CrParties {...commun} parties={PARTIES_RAPPORT} />
      case 'deroule':
        return <CrDeroule {...commun} />
      case 'photos':
        return <CrPhotos {...commun} parties={PARTIES_RAPPORT} />
      case 'bilan':
        return <CrBilan {...commun} />
      case 'fiches':
        return <CrFiches {...commun} />
      case 'recap':
        return <CrRecapitulatif {...commun} parties={PARTIES_RAPPORT}
          dossier={() => dossierSession(brouillon, session)}
          onRecommencer={() => { setBrouillon(BROUILLON_VIDE); setEtape(0) }} />
      default:
        return null
    }
  }

  const premier = etape === 0
  const dernier = etape >= etapesVisibles.length - 1
  const peutAvancer = etapeCourante?.cle === 'session' ? !!session : true

  return (
    <>
      <Nav />
      <main className="portal-page">
        <div className="container" style={{ padding: '28px 32px 12px' }} ref={hautRef}>
          <div className="portal-section-head">
            <p className="portal-section-eyebrow">Espace formateur</p>
            <h1 className="portal-section-title">Compte rendu de formation</h1>
          </div>
          {session && (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: -4 }}>
              {session.moduleFormation} — {periodeLongue(session.debut, session.fin)}
              {session.lieu ? `, ${session.lieu}` : ''}
            </p>
          )}
        </div>

        <section>
          <div className="container" style={{ padding: '8px 32px 56px' }}>
            <CrStepper etapes={etapesVisibles} courante={etape} etats={etats}
              onAller={aller} verrouAu={session ? etapesVisibles.length : 1} />

            <div style={{ marginTop: 22 }}>
              {rendu()}
            </div>

            {etapeCourante?.cle !== 'recap' && (
              <div className="cr-actions">
                <button type="button" className="cr-btn cr-btn--ghost"
                  onClick={() => aller(etape - 1)} disabled={premier}>
                  ← Précédent
                </button>
                <div className="cr-actions-right">
                  {etapeCourante?.cle === 'notes' && !synthese.complet && (
                    <span className="cr-actions-info">
                      {synthese.notesSaisies} note{synthese.notesSaisies > 1 ? 's' : ''} sur {synthese.effectif} — vous pourrez revenir
                    </span>
                  )}
                  <button type="button" className="cr-btn cr-btn--primary"
                    onClick={() => aller(etape + 1)} disabled={dernier || !peutAvancer}>
                    Continuer →
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
