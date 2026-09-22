import { useMemo, useRef } from 'react'
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
import { SESSIONS_FORMATEUR } from '../../data/mock_sessions_formateur'
import { periodeLongue } from '../../utils/compteRendu'
import { brouillonsEnregistres } from '../../utils/brouillonsCompteRendu'
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

  const aRediger = useMemo(
    () => SESSIONS_FORMATEUR.filter(s => s.statut === 'a_rediger'),
    [],
  )
  const termines = useMemo(
    () => SESSIONS_FORMATEUR.filter(s => s.statut === 'termine'),
    [],
  )
  const aVenir = useMemo(
    () => SESSIONS_FORMATEUR.filter(
      s => s.statut === 'en_cours' || s.statut === 'a_venir'),
    [],
  )
  const brouillons = useMemo(() => brouillonsEnregistres(), [])

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
          <PortalReveal id="a-documenter">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">Priorité — compte rendu</p>
                <h2 className="portal-section-title">Vos sessions à documenter</h2>
              </div>
              <PortalStaggerGrid>
                {aRediger.map(s => (
                  <div key={s.id} className="portal-card-anchor">
                    <PvCard
                      {...visuelSession(s)}
                      kicker={
                        <span className="portal-status-chip progress">À rédiger</span>
                      }
                      title={s.moduleFormation}
                      meta={`${periodeLongue(s.debut, s.fin)} · ${s.participants.length} participants · ${s.lieu}`}
                      cta="Rédiger le compte rendu"
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

            {/* Des entrees de module, pas des contenus a illustrer :
                la carte porte l'action, sans visuel qui n'ajouterait
                rien a ce que le libelle dit deja. */}
            <div className="cr-entries">
              <button type="button" className="cr-entry cr-entry--primary"
                onClick={() => naviguer('/portail/compte-rendu/nouveau')}>
                <span className="cr-entry-mark" aria-hidden="true">+</span>
                <span className="cr-entry-body">
                  <span className="cr-entry-title">Nouveau compte rendu</span>
                  <span className="cr-entry-desc">
                    Depuis une session planifiée, ou en saisissant tout
                    manuellement.
                  </span>
                </span>
              </button>

              <button type="button" className="cr-entry"
                onClick={() => naviguer('/portail/compte-rendu/mes-rapports')}>
                <span className="cr-entry-mark" aria-hidden="true">▤</span>
                <span className="cr-entry-body">
                  <span className="cr-entry-title">
                    Mes comptes rendus
                    {termines.length > 0 && (
                      <span className="cr-entry-count">{termines.length}</span>
                    )}
                  </span>
                  <span className="cr-entry-desc">
                    Consulter, télécharger ou reprendre un rapport produit.
                  </span>
                </span>
              </button>

              {brouillons.length > 0 && (
                <button type="button" className="cr-entry cr-entry--draft"
                  onClick={() => naviguer('/portail/compte-rendu/nouveau')}>
                  <span className="cr-entry-mark" aria-hidden="true">⟳</span>
                  <span className="cr-entry-body">
                    <span className="cr-entry-title">
                      Reprendre
                      <span className="cr-entry-count">{brouillons.length}</span>
                    </span>
                    <span className="cr-entry-desc">
                      {brouillons[0].session || 'Compte rendu'} — saisie en cours.
                    </span>
                  </span>
                </button>
              )}
            </div>
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
                      meta={`${periodeLongue(s.debut, s.fin)} · ${s.participants.length} participants · ${s.lieu}`}
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
