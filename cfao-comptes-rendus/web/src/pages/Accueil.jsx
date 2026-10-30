import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Footer from '../components/portail/Footer'
import Nav from '../components/portail/Nav'
import PortalHeader from '../components/portail/PortalHeader'
import PortalReveal from '../components/portail/PortalReveal'
import PortalStaggerGrid from '../components/portail/PortalStaggerGrid'
import PortalStickyBar from '../components/portail/PortalStickyBar'
import PvCard from '../components/portail/PvCard'
import { sessionsDuFormateur } from '../data/mock_sessions_formateur'
import useAjustementEcran from '../hooks/useAjustementEcran'
import useEnHautDePage from '../hooks/useEnHautDePage'
import usePortalBackground from '../hooks/usePortalBackground'
import usePortalHeaderHeight from '../hooks/usePortalHeaderHeight'
import useSiteEffects from '../hooks/useSiteEffects'
import { useAuth } from '../lib/auth'
import {
  brouillonsEnregistres, brouillonsTermines, synchroniser,
} from '../utils/brouillonsCompteRendu'
import { periodeLongue } from '../utils/compteRendu'
import { lireErreurs } from '../utils/journalErreurs'
import { aDocumenter, sessionsAVenir } from '../utils/planningFormateur.js'
import { resolvePortalCardBrand } from '../utils/portalCardMedia.js'
import { scrollToPortalSection } from '../utils/portalScroll.js'

/** Visuel des cartes de session, par pole — meme table que `SessionCard`.
 *
 * Surtout pas la fiche catalogue : `technicien_<marque>.png` est le
 * schema des niveaux de competences, lisible sur une fiche A4, illisible
 * et hors sujet en vignette de carte. Les `*-carte.jpg` sont les visuels
 * des publics sans leur cadre blanc : la photo couvre toute la vignette. */
const VISUEL_POLE = {
  Motors: '/assets/img_cards/techniciens-carte.jpg',
  Equipment: '/assets/img_cards/techniciens-carte.jpg',
  Carrosserie: '/assets/publics/carrossiers.jpg',
}

/** Visuel des cartes de priorite, une par zone du portail. */
const VISUEL_PRIORITE = {
  comptesRendus: '/assets/img_cards/test_theorie_senior.jpg',
  sessions: '/assets/img_cards/clients-carte.jpg',
  journal: '/assets/img_cards/process_sav_equipment.png',
}

/** Visuel des cartes d'entree du module. */
const VISUEL_ENTREE = {
  nouveau: '/assets/publics/process-sav.jpg',
  archive: '/assets/img_cards/certification.jpg',
  brouillon: '/assets/publics/process-sav.jpg',
}

/** « il y a 2 jours », pour situer une reprise sans afficher une date brute. */
function venuDe(iso) {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  if (jours < 14) return `il y a ${jours} jours`
  return `il y a ${Math.round(jours / 7)} semaines`
}

function visuelSession(session) {
  const { logo, label } = resolvePortalCardBrand(session.marque)
  return {
    img: VISUEL_POLE[session.pole] ?? '/assets/img_cards/techniciens-carte.jpg',
    logo,
    brandLabel: logo ? undefined : label,
  }
}

/**
 * Tableau de bord du formateur — calque sur celui du portail.
 *
 * Memes briques, meme rythme : entete portail, barre collante, sections
 * `PortalReveal` avec surtitre et titre, grilles `PvCard`.
 *
 * Trois sections, dans l'ordre ou il en a besoin :
 *
 *   1. **Priorites** — les comptes rendus a documenter et les sessions a
 *      venir. L'ancre `a-documenter` est la cible du menu « Priorites ».
 *   2. **Comptes rendus** — les entrees du module : en ouvrir un,
 *      reprendre un brouillon, relire les precedents.
 *   3. **Vos prochaines sessions** — ce qu'il anime bientot.
 */
export default function Accueil() {
  useEnHautDePage('Accueil')
  useSiteEffects()
  const { user } = useAuth()
  const naviguer = useNavigate()
  const headerRef = useRef(null)

  // Le fond hero suit le portail : la page le porte elle-meme.
  usePortalBackground(user)

  // Publie la hauteur de l'entete : la section prioritaire s'en sert pour
  // occuper exactement le reste de l'ecran.
  usePortalHeaderHeight(headerRef)
  const contenuPriorites = useRef(null)
  useAjustementEcran(contenuPriorites, [Boolean(user)])

  const sessions = useMemo(() => sessionsDuFormateur(user), [user])
  const aVenir = useMemo(() => sessionsAVenir(sessions), [sessions])
  // Ceux de ce navigateur tout de suite, puis ceux du service — saisis
  // sur un autre poste — des qu'il repond.
  const [brouillons, setBrouillons] = useState(() => brouillonsEnregistres())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setBrouillons(liste) })
    return () => { actif = false }
  }, [])
  // Les comptes rendus termines vont a l'archive ; a documenter : les
  // saisies a continuer et les sessions passees encore sans compte rendu.
  const termines = brouillonsTermines(brouillons)
  const { aContinuer: enCours, aCommencer } = aDocumenter(sessions, brouillons)

  const nbADocumenter = aCommencer.length + enCours.length
  // Equipe technique : le journal des erreurs, que Cerbos reserve au superadmin.
  const superadmin = (user?.roles ?? []).includes('superadmin')
  // Journal vide (ou illisible) : 0, donc pas de carte ; le menu y mene toujours.
  const [nbErreurs, setNbErreurs] = useState(0)
  useEffect(() => {
    if (!superadmin) return undefined
    let actif = true
    lireErreurs().then(liste => { if (actif) setNbErreurs(liste?.length ?? 0) }).catch(() => {})
    return () => { actif = false }
  }, [superadmin])
  // Une carte par zone, au modele du portail : la pastille porte le nombre
  // d'elements qui attendent le formateur ; une zone a 0 n'a pas de carte.
  const priorites = [
    {
      id: 'cr', img: VISUEL_PRIORITE.comptesRendus, nombre: nbADocumenter,
      enAttente: 'à rédiger', titre: 'Comptes rendus à rédiger',
      meta: `${enCours.length} non terminé${enCours.length > 1 ? 's' : ''}, ${aCommencer.length} à commencer.`,
      metaVide: 'Tous vos comptes rendus sont à jour.',
      lien: '/portail/compte-rendu/a-documenter', cta: 'Voir les comptes rendus à rédiger',
    },
    {
      id: 'sessions', img: VISUEL_PRIORITE.sessions, nombre: aVenir.length,
      enAttente: 'à venir', titre: 'Sessions de formation à venir',
      meta: 'Les sessions de formation que vous animez prochainement.',
      metaVide: 'Aucune session de formation planifiée pour le moment.',
      section: aVenir.length ? 'sessions-a-venir' : null, cta: 'Voir les sessions de formation',
    },
    ...(superadmin ? [{
      id: 'journal', img: VISUEL_PRIORITE.journal, nombre: nbErreurs,
      enAttente: nbErreurs > 1 ? 'erreurs' : 'erreur', titre: 'Journal des erreurs',
      meta: 'Les erreurs du service des comptes rendus.',
      lien: '/portail/journal-erreurs', cta: 'Ouvrir le journal des erreurs',
    }] : []),
  ].filter(c => c.nombre !== 0)
  // Plus aucune carte : la section (et son entree de menu) disparait.
  const rienAFaire = priorites.length === 0

  if (!user) return null

  return (
    <>
      <Nav sansPriorites={rienAFaire} />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── 1. Priorites : ce qui attend une action du formateur ── */}
        {/* Un compteur par section, a 0 quand rien n'attend : le formateur
            voit d'un coup d'oeil ou agir, sans carte vide. Masquee quand
            les deux sont a 0. */}
        {!rienAFaire && <PortalReveal id="a-documenter" className="portal-next-actions-viewport">
          <div ref={contenuPriorites} className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Vos priorités</p>
              <h2 className="portal-section-title">À faire maintenant</h2>
            </div>
            <PortalStaggerGrid>
              {priorites.map(c => (
                <div key={c.id} className="portal-card-anchor">
                  <PvCard
                    img={c.img}
                    kicker={
                      <span className={`portal-status-chip ${c.nombre ? 'progress' : 'done'}`}>
                        {c.nombre === null ? c.enAttente : `${c.nombre} ${c.enAttente}`}
                      </span>
                    }
                    title={c.titre}
                    meta={c.nombre !== 0 ? c.meta : c.metaVide}
                    cta={c.lien || c.section ? c.cta : undefined}
                    accentColor={c.nombre ? '#E3001B' : undefined}
                    hoverHint={c.lien || c.section ? c.cta : undefined}
                    onClick={c.lien ? () => naviguer(c.lien)
                      : c.section ? () => scrollToPortalSection(c.section) : undefined}
                    corner={Boolean(c.lien || c.section)}
                  />
                </div>
              ))}
            </PortalStaggerGrid>
          </div>
        </PortalReveal>}

        {/* ── 2. Le module compte rendu ─────────────────────────── */}
        <PortalReveal id="comptes-rendus">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Vos documents</p>
              <h2 className="portal-section-title">Comptes rendus</h2>
            </div>

            {/* Trois entrees : commencer (toujours), reprendre et retrouver
                (seulement s'il y a quelque chose). Les sessions a documenter se choisissent a
                l'ouverture d'un nouveau compte rendu. */}
            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.nouveau}
                  kicker={
                    <span className="portal-status-chip progress">Rédiger</span>
                  }
                  title="Nouveau compte rendu"
                  meta="Depuis une session de formation planifiée, ou en saisissant tout manuellement."
                  cta="Commencer"
                  accentColor="#E3001B"
                  hoverHint="Compléter un compte rendu"
                  onClick={() => naviguer('/portail/compte-rendu/nouveau')}
                  corner
                />
              </div>

              {/* Une seule entree vers les saisies commencees : la liste,
                  avec reprise et suppression, est sur sa propre page.
                  Sans saisie en cours, la carte n'a pas d'interet. */}
              {enCours.length > 0 && <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.brouillon}
                  kicker={
                    <span className="portal-status-chip todo">
                      {enCours.length} non terminé{enCours.length > 1 ? 's' : ''}
                    </span>
                  }
                  title="Comptes rendus non terminés"
                  meta={`Reprendre ou supprimer un compte rendu commencé — le dernier modifié ${
                    venuDe(enCours[0].modifieLe)}.`}
                  cta="Voir les comptes rendus non terminés"
                  hoverHint="Terminer un compte rendu"
                  onClick={() => naviguer('/portail/compte-rendu/en-cours')}
                  corner
                />
              </div>}

              {termines.length > 0 && <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.archive}
                  kicker={
                    <span className="portal-status-chip done">
                      {termines.length} terminé{termines.length > 1 ? 's' : ''}
                    </span>
                  }
                  title="Comptes rendus terminés"
                  meta={`Les comptes rendus terminés — le dernier ${venuDe(termines[0].termineLe)}.`}
                  cta="Ouvrir l’archive"
                  hoverHint="Voir les comptes rendus terminés"
                  onClick={() => naviguer('/portail/compte-rendu/mes-rapports')}
                  corner
                />
              </div>}
            </PortalStaggerGrid>
          </div>
        </PortalReveal>

        {/* ── 3. Ce qu'il anime bientot ─────────────────────────── */}
        {aVenir.length > 0 && (
          <PortalReveal id="sessions-a-venir">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">Planning — animation</p>
                <h2 className="portal-section-title">Vos prochaines sessions de formation</h2>
              </div>
              <PortalStaggerGrid>
                {aVenir.map(s => (
                  <div key={s.id} className="portal-card-anchor">
                    <PvCard
                      {...visuelSession(s)}
                      kicker={
                        <span className={`portal-status-chip ${
                          s.statut === 'en_cours' ? 'progress' : 'todo'}`}>
                          {s.statut === 'en_cours' ? 'En cours' : 'À venir'}
                        </span>
                      }
                      title={s.moduleFormation}
                      meta={`${periodeLongue(s.debut, s.fin)} · ${s.participants.length} stagiaires · ${s.lieu}`}
                      cta="Voir la session de formation"
                      hoverHint="Voir la session de formation"
                      // La fiche de session n'existe pas encore : la carte
                      // reagit au clic, sans rediriger.
                      onClick={() => {}}
                      corner
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        )}
      </main>

      <Footer />
    </>
  )
}
