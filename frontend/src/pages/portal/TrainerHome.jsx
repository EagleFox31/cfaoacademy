import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import PvCard from '../../components/PvCard'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHeaderHeight from '../../hooks/usePortalHeaderHeight.js'
import { SESSIONS_FORMATEUR } from '../../data/mock_sessions_formateur'
import { periodeLongue } from '../../utils/compteRendu'
import {
  brouillonsEnCours, brouillonsEnregistres, brouillonsTermines, synchroniser,
} from '../../utils/brouillonsCompteRendu'
import { resolvePortalCardBrand } from '../../utils/portalCardMedia.js'
import '../../styles/compte-rendu.css'

/** Visuel des cartes de session, par pole — meme table que `SessionCard`.
 *
 * Surtout pas la fiche catalogue : `technicien_<marque>.png` est le
 * schema des niveaux de competences, lisible sur une fiche A4, illisible
 * et hors sujet en vignette de carte. */
const VISUEL_POLE = {
  Motors: '/assets/publics/techniciens.jpg',
  Equipment: '/assets/publics/techniciens.jpg',
  Carrosserie: '/assets/publics/carrossiers.jpg',
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
    img: VISUEL_POLE[session.pole] ?? '/assets/publics/techniciens.jpg',
    logo,
    brandLabel: logo ? undefined : label,
  }
}

/**
 * Tableau de bord du formateur — calque sur celui du technicien.
 *
 * Memes briques, meme rythme : entete portail, barre collante, sections
 * `PortalReveal` avec surtitre et titre, grilles `PvCard`. Un formateur
 * qui a deja vu le portail cote apprenant n'a rien a reapprendre.
 *
 * Trois sections, dans l'ordre ou il en a besoin :
 *
 *   1. **Vos sessions a documenter** — les formations terminees dont le
 *      compte rendu manque. C'est ce qu'il vient chercher.
 *   2. **Comptes rendus** — les entrees du module : en ouvrir un,
 *      reprendre un brouillon, relire les precedents.
 *   3. **Vos prochaines sessions** — ce qu'il anime bientot.
 */
export default function TrainerHome() {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const naviguer = useNavigate()
  const headerRef = useRef(null)

  // Le fond hero suit le profil. `Portal` l'applique deja quand on arrive
  // par `/portail`, mais il le retire au demontage : la page doit le
  // porter elle-meme pour survivre a une navigation interne.
  usePortalBackground(user)

  // Publie la hauteur de l'entete : la section prioritaire s'en sert pour
  // occuper exactement le reste de l'ecran.
  usePortalHeaderHeight(headerRef)

  const aVenir = useMemo(
    () => SESSIONS_FORMATEUR.filter(
      s => s.statut === 'en_cours' || s.statut === 'a_venir'),
    [],
  )
  // Ceux de ce navigateur tout de suite, puis ceux du serveur — saisis
  // sur un autre poste — des qu'il repond.
  const [brouillons, setBrouillons] = useState(() => brouillonsEnregistres())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setBrouillons(liste) })
    return () => { actif = false }
  }, [])
  // Les comptes rendus termines vont a l'archive, et leur session ne
  // figure plus parmi celles a documenter.
  const enCours = brouillonsEnCours(brouillons)
  const termines = brouillonsTermines(brouillons)
  const aRediger = SESSIONS_FORMATEUR.filter(s => s.statut === 'a_rediger'
    && !termines.some(b => b.id === s.id))

  if (!user) return null

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── 1. Les sessions qui attendent leur compte rendu ──── */}
        {aRediger.length > 0 && (
          <PortalReveal id="a-documenter"
            className="portal-next-actions-viewport cr-viewport">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">Priorité — compte rendu</p>
                <h2 className="portal-section-title">Vos sessions à documenter</h2>
              </div>
              {/* Section tenue a un ecran : la meta se limite aux dates et
                  a l'effectif. Le lieu se lit sur la fiche de session. */}
              <PortalStaggerGrid>
                {aRediger.map(s => (
                  <div key={s.id} className="portal-card-anchor">
                    <PvCard
                      {...visuelSession(s)}
                      kicker={
                        <span className="portal-status-chip progress">À rédiger</span>
                      }
                      title={s.moduleFormation}
                      meta={`${periodeLongue(s.debut, s.fin)} · ${s.participants.length} stagiaires`}
                      cta="Écrire le compte rendu"
                      accentColor="#E3001B"
                      hoverHint="Ouvrir le compte rendu"
                      onClick={() => naviguer(`/portail/compte-rendu/nouveau?session=${s.id}`)}
                      corner
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        )}

        {/* ── 2. Le module compte rendu ─────────────────────────── */}
        <PortalReveal id="comptes-rendus">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Vos documents</p>
              <h2 className="portal-section-title">Comptes rendus</h2>
            </div>

            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.nouveau}
                  kicker={<span className="portal-status-chip progress">Rédiger</span>}
                  title="Nouveau compte rendu"
                  meta="Depuis une session planifiée, ou en saisissant tout manuellement."
                  cta="Commencer"
                  accentColor="#E3001B"
                  hoverHint="Ouvrir un compte rendu"
                  onClick={() => naviguer('/portail/compte-rendu/nouveau')}
                  corner
                />
              </div>

              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.archive}
                  kicker={
                    <span className="portal-status-chip done">
                      {termines.length > 0
                        ? `${termines.length} rapport${termines.length > 1 ? 's' : ''}`
                        : 'Archive'}
                    </span>
                  }
                  title="Mes comptes rendus"
                  meta={termines.length
                    ? `Les comptes rendus terminés — le dernier ${venuDe(termines[0].termineLe)}.`
                    : 'Les comptes rendus terminés s’y rangent.'}
                  cta="Ouvrir l’archive"
                  hoverHint="Voir les rapports produits"
                  onClick={() => naviguer('/portail/compte-rendu/mes-rapports')}
                  corner
                />
              </div>

              {/* Une seule entree vers les saisies commencees : une carte
                  par brouillon noyait la section des qu'il y en avait
                  plusieurs. La liste, avec reprise et suppression, est sur
                  sa propre page. */}
              {enCours.length > 0 && (
                <div className="portal-card-anchor">
                  <PvCard
                    img={VISUEL_ENTREE.brouillon}
                    kicker={
                      <span className="portal-status-chip todo">
                        {enCours.length} en cours
                      </span>
                    }
                    title="Comptes rendus en cours"
                    meta={`Reprendre ou supprimer une saisie commencée — la dernière ${
                      venuDe(enCours[0].modifieLe)}.`}
                    cta="Voir les saisies"
                    hoverHint="Choisir un compte rendu à reprendre"
                    onClick={() => naviguer('/portail/compte-rendu/en-cours')}
                    corner
                  />
                </div>
              )}
            </PortalStaggerGrid>
          </div>
        </PortalReveal>

        {/* ── 3. Ce qu'il anime bientot ─────────────────────────── */}
        {aVenir.length > 0 && (
          <PortalReveal id="sessions-a-venir">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">Planning — animation</p>
                <h2 className="portal-section-title">Vos prochaines sessions</h2>
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
                      cta="Voir la session"
                      hoverHint="Voir la session"
                      onClick={() => naviguer(`/portail/compte-rendu/nouveau?session=${s.id}`)}
                      corner
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        )}

        <PortalAssistanceSection t={t} variant="learner" />
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
