import { useMemo, useRef } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import PvCard from '../../components/PvCard'
import { scrollToPortalSection } from '../../utils/portalScroll.js'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHeaderHeight from '../../hooks/usePortalHeaderHeight.js'
import useAjustementEcran from '../../hooks/useAjustementEcran.js'
import { sessionsDuFormateur } from '../../data/mock_sessions_formateur'
import { sessionsAVenir } from '../../utils/sessionsAVenir.js'
import { periodeLongue } from '../../utils/dates.js'
import { adresseComptesRendus } from '../../utils/urlComptesRendus.js'
import { resolvePortalCardBrand } from '../../utils/portalCardMedia.js'

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
  sessions: '/assets/img_cards/clients-carte.jpg',
  assistance: '/assets/img_cards/techniciens-carte.jpg',
  journal: '/assets/img_cards/process_sav_equipment.png',
}

/** Visuel des cartes d'entree du module. */
const VISUEL_ENTREE = {
  nouveau: '/assets/publics/process-sav.jpg',
  archive: '/assets/img_cards/certification.jpg',
  brouillon: '/assets/publics/process-sav.jpg',
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
 * Tableau de bord du formateur — calque sur celui du technicien.
 *
 * Memes briques, meme rythme : entete portail, barre collante, sections
 * `PortalReveal` avec surtitre et titre, grilles `PvCard`. Un formateur
 * qui a deja vu le portail cote apprenant n'a rien a reapprendre.
 *
 * Trois sections, dans l'ordre ou il en a besoin :
 *
 *   1. **Priorites** — une carte par zone du portail avec son compteur
 *      (sessions a venir, assistance aux techniciens). L'ancre historique
 *      `a-documenter` reste son identifiant (cible du menu « Priorites »).
 *   2. **Comptes rendus** — les entrees du module, servi a part : en ouvrir
 *      un, reprendre un brouillon, relire les precedents.
 *   3. **Vos prochaines sessions** — ce qu'il anime bientot.
 */
export default function TrainerHome() {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  // Le module des comptes rendus est une application à part : on y va par
  // son adresse, pas par une route du portail.
  const ouvrirModule = chemin => window.location.assign(adresseComptesRendus({ pathname: chemin }))
  const headerRef = useRef(null)

  // Le fond hero suit le profil. `Portal` l'applique deja quand on arrive
  // par `/portail`, mais il le retire au demontage : la page doit le
  // porter elle-meme pour survivre a une navigation interne.
  usePortalBackground(user)

  // Publie la hauteur de l'entete : la section prioritaire s'en sert pour
  // occuper exactement le reste de l'ecran.
  usePortalHeaderHeight(headerRef)
  const contenuPriorites = useRef(null)
  useAjustementEcran(contenuPriorites, [Boolean(user)])

  const sessions = useMemo(() => sessionsDuFormateur(user), [user])
  const aVenir = useMemo(() => sessionsAVenir(sessions), [sessions])
  // Equipe technique : le journal des erreurs vit dans le module des
  // comptes rendus, qui decide seul qui le lit (Cerbos).
  const superadmin = (user?.roles ?? []).includes('superadmin')

  // Assistance aux techniciens : module a venir, rien n'attend encore.
  const assistanceEnAttente = 0
  // Une carte par zone du portail, au modele des autres : la pastille
  // porte le nombre d'elements qui attendent le formateur, 0 compris.
  const priorites = [
    {
      id: 'sessions', img: VISUEL_PRIORITE.sessions, nombre: aVenir.length,
      enAttente: 'à venir', titre: 'Sessions de formation à venir',
      meta: 'Les sessions de formation que vous animez prochainement.',
      metaVide: 'Aucune session de formation planifiée pour le moment.',
      section: aVenir.length ? 'sessions-a-venir' : null, cta: 'Voir les sessions de formation',
    },
    {
      id: 'assistance', img: VISUEL_PRIORITE.assistance, nombre: assistanceEnAttente,
      enAttente: 'en attente', titre: 'Assistance aux techniciens',
      meta: 'Des techniciens attendent votre aide.',
      metaVide: 'Aucune demande d’assistance en attente.',
      section: null, cta: 'Voir les demandes',
    },
    ...(superadmin ? [{
      id: 'journal', img: VISUEL_PRIORITE.journal, nombre: null,
      enAttente: 'équipe technique', titre: 'Journal des erreurs',
      meta: 'Les erreurs du service des comptes rendus.',
      lien: '/portail/journal-erreurs', cta: 'Ouvrir le journal des erreurs',
    }] : []),
  ]

  if (!user) return null

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── 1. Priorites : ce qui attend une action du formateur ── */}
        {/* Un compteur par section, a 0 quand rien n'attend : le formateur
            voit d'un coup d'oeil ou agir, sans carte vide. */}
        <PortalReveal id="a-documenter" className="portal-next-actions-viewport">
          <div ref={contenuPriorites} className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_next_actions}</p>
              <h2 className="portal-section-title">{t.title_next_actions}</h2>
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
                    cta={c.section || c.lien ? c.cta : undefined}
                    accentColor={c.nombre ? '#E3001B' : undefined}
                    hoverHint={c.section || c.lien ? c.cta : undefined}
                    onClick={c.lien ? () => ouvrirModule(c.lien)
                      : c.section ? () => scrollToPortalSection(c.section) : undefined}
                    corner={Boolean(c.section || c.lien)}
                  />
                </div>
              ))}
            </PortalStaggerGrid>
          </div>
        </PortalReveal>

        {/* ── 2. Le module compte rendu ─────────────────────────── */}
        <PortalReveal id="comptes-rendus">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Vos documents</p>
              <h2 className="portal-section-title">Comptes rendus</h2>
            </div>

            {/* Trois entrees, toujours presentes : commencer, reprendre,
                retrouver. Les sessions a documenter se choisissent a
                l'ouverture d'un nouveau compte rendu. */}
            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.nouveau}
                  kicker={
                    <span className="portal-status-chip progress">À rédiger</span>
                  }
                  title="Nouveau compte rendu"
                  meta="Depuis une session de formation planifiée, ou en saisissant tout manuellement."
                  cta="Commencer"
                  accentColor="#E3001B"
                  hoverHint="Ouvrir un compte rendu"
                  onClick={() => ouvrirModule('/portail/compte-rendu/nouveau')}
                  corner
                />
              </div>

              {/* Une seule entree vers les saisies commencees : la liste,
                  avec reprise et suppression, est sur sa propre page. */}
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.brouillon}
                  kicker={
                    <span className="portal-status-chip todo">En cours</span>
                  }
                  title="Comptes rendus en cours"
                  meta="Reprendre ou supprimer une saisie commencée — elles se retrouvent sur tout poste."
                  cta="Voir les saisies"
                  hoverHint="Choisir un compte rendu à reprendre"
                  onClick={() => ouvrirModule('/portail/compte-rendu/en-cours')}
                  corner
                />
              </div>

              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.archive}
                  kicker={
                    <span className="portal-status-chip done">Archive</span>
                  }
                  title="Mes comptes rendus"
                  meta="Les comptes rendus terminés s’y rangent."
                  cta="Ouvrir l’archive"
                  hoverHint="Voir les rapports produits"
                  onClick={() => ouvrirModule('/portail/compte-rendu/mes-rapports')}
                  corner
                />
              </div>
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

        <PortalAssistanceSection t={t} variant="learner" />
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
