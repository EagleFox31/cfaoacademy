import { useMemo, useRef } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import PortalConstructionMedia from '../../components/PortalConstructionMedia.jsx'
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
  comptesRendus: '/assets/img_cards/test_theorie_senior.jpg',
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

/**
 * Sections annoncees, sans ecran derriere (matrice des sections, colonne
 * Formateur) : une carte en construction chacune, branchee ensuite une a une.
 * `id` = ancre de la section, cible de la navbar (`PORTAL_NAV_SECTIONS.trainer`).
 */
const SECTIONS_A_VENIR = [
  { id: 'formations', surtitre: 'formations_eyebrow', titre: 'formations_title',
    cartes: [['formations_card', 'formations_meta']] },
  { id: 'competences', surtitre: 'comp_eyebrow', titre: 'comp_title',
    cartes: [['tests_card', 'tests_meta'], ['results_card', 'results_meta']] },
  { id: 'certifs', surtitre: 'certifs_eyebrow', titre: 'certifs_title',
    cartes: [['certifs_card', 'certifs_meta']] },
]

function visuelSession(session) {
  const { logo, label } = resolvePortalCardBrand(session.marque)
  return {
    img: VISUEL_POLE[session.pole] ?? '/assets/img_cards/techniciens-carte.jpg',
    logo,
    brandLabel: logo ? undefined : label,
  }
}

/** « 12–14 mars 2027 » dans la langue de l'interface. */
function periode(locale, debut, fin) {
  const d = new Date(debut)
  const f = new Date(fin)
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(d, f)
}

/** Nombre de stagiaires, au singulier jusqu'a 1. */
function stagiaires(t, n) {
  return ((n <= 1 && t.session_trainees_one) || t.session_trainees).replace('{n}', n)
}

/** En-tete de section du portail : surtitre et titre. */
function TeteSection({ surtitre, titre }) {
  return (
    <div className="portal-section-head">
      <p className="portal-section-eyebrow">{surtitre}</p>
      <h2 className="portal-section-title">{titre}</h2>
    </div>
  )
}

/**
 * Tableau de bord du formateur — calque sur celui du technicien.
 *
 * Memes briques, meme rythme : entete portail, barre collante, sections
 * `PortalReveal` avec surtitre et titre, grilles `PvCard`. Un formateur
 * qui a deja vu le portail cote apprenant n'a rien a reapprendre.
 *
 * Sections, dans l'ordre ou il en a besoin :
 *
 *   1. **Priorites** — une carte par zone du portail avec son compteur
 *      (comptes rendus a documenter, sessions a venir, assistance). L'ancre historique
 *      `a-documenter` reste son identifiant (cible du menu « Priorites »).
 *   2. **Comptes rendus** — les entrees du module, servi a part : en ouvrir
 *      un, reprendre un brouillon, relire les precedents.
 *   3. **Vos prochaines sessions** — ce qu'il anime bientot.
 *   4. **Formations a dispenser**, **Tests et resultats** (resultats toutes
 *      filiales, sur ses marques et domaines), **Certifications** : en
 *      construction (`SECTIONS_A_VENIR`).
 */
export default function TrainerHome() {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('trainerHome')
  const { t: tPortal, locale } = useLocale('portal')
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
    // Le compte des saisies vit dans le module des comptes rendus : la carte
    // y mene, sans nombre (comme le journal).
    {
      id: 'cr', img: VISUEL_PRIORITE.comptesRendus, nombre: null,
      enAttente: t.prio_cr_chip, titre: t.prio_cr_title, meta: t.prio_cr_meta,
      lien: '/portail/compte-rendu/a-documenter', cta: t.prio_cr_cta,
    },
    {
      id: 'sessions', img: VISUEL_PRIORITE.sessions, nombre: aVenir.length,
      enAttente: t.prio_sessions_chip, titre: t.prio_sessions_title,
      meta: t.prio_sessions_meta, metaVide: t.prio_sessions_empty,
      section: aVenir.length ? 'sessions-a-venir' : null, cta: t.prio_sessions_cta,
    },
    {
      id: 'assistance', img: VISUEL_PRIORITE.assistance, nombre: assistanceEnAttente,
      enAttente: t.prio_assist_chip, titre: t.prio_assist_title,
      meta: t.prio_assist_meta, metaVide: t.prio_assist_empty,
      section: null, cta: t.prio_assist_cta,
    },
    ...(superadmin ? [{
      id: 'journal', img: VISUEL_PRIORITE.journal, nombre: null,
      enAttente: t.prio_journal_chip, titre: t.prio_journal_title,
      meta: t.prio_journal_meta,
      lien: '/portail/journal-erreurs', cta: t.prio_journal_cta,
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
            <TeteSection surtitre={tPortal.eyebrow_next_actions} titre={tPortal.title_next_actions} />
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
            <TeteSection surtitre={t.cr_eyebrow} titre={t.cr_title} />

            {/* Trois entrees, toujours presentes : commencer, reprendre,
                retrouver. Les sessions a documenter se choisissent a
                l'ouverture d'un nouveau compte rendu. */}
            <PortalStaggerGrid>
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.nouveau}
                  kicker={<span className="portal-status-chip progress">{t.cr_new_chip}</span>}
                  title={t.cr_new_title}
                  meta={t.cr_new_meta}
                  cta={t.cr_new_cta}
                  accentColor="#E3001B"
                  hoverHint={t.cr_new_hint}
                  onClick={() => ouvrirModule('/portail/compte-rendu/nouveau')}
                  corner
                />
              </div>

              {/* Une seule entree vers les saisies commencees : la liste,
                  avec reprise et suppression, est sur sa propre page. */}
              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.brouillon}
                  kicker={<span className="portal-status-chip todo">{t.cr_draft_chip}</span>}
                  title={t.cr_draft_title}
                  meta={t.cr_draft_meta}
                  cta={t.cr_draft_cta}
                  hoverHint={t.cr_draft_hint}
                  onClick={() => ouvrirModule('/portail/compte-rendu/en-cours')}
                  corner
                />
              </div>

              <div className="portal-card-anchor">
                <PvCard
                  img={VISUEL_ENTREE.archive}
                  kicker={<span className="portal-status-chip done">{t.cr_archive_chip}</span>}
                  title={t.cr_archive_title}
                  meta={t.cr_archive_meta}
                  cta={t.cr_archive_cta}
                  hoverHint={t.cr_archive_hint}
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
              <TeteSection surtitre={t.sessions_eyebrow} titre={t.sessions_title} />
              <PortalStaggerGrid>
                {aVenir.map(s => (
                  <div key={s.id} className="portal-card-anchor">
                    {/* La fiche de session n'existe pas encore : visuel
                        garde, chantier au survol, aucun lien. */}
                    <PvCard
                      {...visuelSession(s)}
                      kicker={
                        <span className={`portal-status-chip ${
                          s.statut === 'en_cours' ? 'progress' : 'todo'}`}>
                          {s.statut === 'en_cours' ? t.session_running : t.session_upcoming}
                        </span>
                      }
                      title={s.moduleFormation}
                      meta={`${periode(locale, s.debut, s.fin)} · ${stagiaires(t, s.participants.length)} · ${s.lieu}`}
                      enConstruction={t.under_construction}
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        )}

        {/* ── 4. Sections annoncees : cartes en construction ────── */}
        {SECTIONS_A_VENIR.map(section => (
          <PortalReveal key={section.id} id={section.id}>
            <div className="container" style={{ padding: '16px 32px' }}>
              <TeteSection surtitre={t[section.surtitre]} titre={t[section.titre]} />
              <PortalStaggerGrid>
                {section.cartes.map(([titre, meta]) => (
                  <div key={titre} className="portal-card-anchor">
                    <PvCard
                      cardMedia={<PortalConstructionMedia label={t.under_construction} />}
                      kicker={<span className="portal-status-chip todo">{t.chip_follow}</span>}
                      title={t[titre]}
                      meta={t[meta]}
                    />
                  </div>
                ))}
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        ))}

        <PortalAssistanceSection t={tPortal} variant="learner" />
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
