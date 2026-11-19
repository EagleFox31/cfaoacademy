import { useEffect, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalSectionSkeleton from '../../components/PortalSectionSkeleton.jsx'
import PvCard from '../../components/PvCard'
import PortalConstructionMedia from '../../components/PortalConstructionMedia.jsx'
import PortalCardKpis from '../../components/PortalCardKpis.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHeaderHeight from '../../hooks/usePortalHeaderHeight.js'
import { planningApi } from '../../lib/planningApi.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { lienPlanning, planningMenu } from '../../utils/planningAccess.js'
import { reviewText } from './costKey/reviewText.js'
import { versBesoins } from '../../utils/urlBesoins.js'
import { BRANDS, STATS } from '../../data/index.js'
import PortalIconMedia from '../../components/PortalIconMedia.jsx'
import CenterDirectorSections, { PAYS_ACADEMY, SECTIONS_COORDINATEUR, anneeDuResume, paysAttendus } from './CenterDirectorSections.jsx'

const ROUGE = '#E3001B'


/** Une carte par écran de la clé : visuel et adresse (les vues de CleRepartition). */
const OUTILS = {
  table: { img: '/assets/img_cards/clients-carte.jpg', vue: 'table' },
  country: { img: '/assets/img_cards/process_pieces_motors.png', vue: 'country', query: { pays: 'all' } },
  themes: { img: '/assets/img_cards/formation_niveau_1_test_theorique.png', vue: 'themes' },
  settings: { img: '/assets/img_cards/process_pieces_equipment.png', vue: 'settings' },
  prepare: { img: '/assets/img_cards/certification.jpg', vue: 'prepare' },
}

const BIENTOT = {
  director: ['fill', 'sessions', 'trainers'],
  assistant: ['sessions', 'convocations', 'fill'],
}

const remplir = (texte, valeurs) =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), texte)

/**
 * La clé d'une année, tous pôles confondus : une seule carte par année. Les
 * chiffres viennent tels quels du résumé serveur (/years/summary) ; `points` :
 * points à traiter de l'année (/years/{année}/review-items).
 */
export function etatAnnee(ligne, points = []) {
  const a = anneeDuResume(ligne)
  return {
    statut: a.statut,
    places: a.places,
    offertes: a.offertes,
    taux: a.taux,
    repondu: a.repondu,
    connues: a.connus,
    points,
  }
}

/**
 * Alertes de la cloche à partir des points à traiter de la clé. Sans `ouvrir`
 * (rôle observateur), l'alerte se lit sans lien d'action.
 */
export function alertesCle(points, tCle, locale, ouvrir = null) {
  return points.flatMap(i => {
    const text = reviewText(tCle, locale, i)
    if (!text) return []
    const alerte = { id: i.id, label: `${i.country_label} · ${i.code}`, text }
    return [ouvrir ? { ...alerte, cta: tCle.review_open, onOpen: () => ouvrir(i) } : alerte]
  })
}

/**
 * Charge la clé de la dernière année (synthèse tous pôles) : état, places,
 * réponses des filiales, points à traiter. Le directeur aussi : sa cloche
 * affiche les points.
 */
function useEtatCle() {
  const [etat, setEtat] = useState({ statut: 'chargement', access: null, annee: null, cle: null })

  useEffect(() => {
    let actif = true
    ;(async () => {
      try {
        const [access, { years = [] }] = await Promise.all([planningApi.access(), planningApi.yearSummary()])
        if (!years.length) {
          if (actif) setEtat({ statut: 'vide', access, annee: null, cle: null })
          return
        }
        const [derniere] = years // le serveur les range de la plus récente à la plus ancienne
        const points = await planningApi.reviewItems(derniere.year).catch(() => [])
        if (actif) setEtat({ statut: 'pret', access, annee: derniere.year, cle: etatAnnee(derniere, points) })
      } catch {
        if (actif) setEtat({ statut: 'erreur', access: null, annee: null, cle: null })
      }
    })()
    return () => { actif = false }
  }, [])

  return etat
}

/**
 * Chiffres du hero : le périmètre de l'Academy. Les pays sont ceux de la carte
 * de la page d'accueil (même source, pas un second chiffre) ; les marques sont
 * celles de la clé de l'année, tous pôles confondus, comptées une fois.
 */
export function chiffresHero({ mode }) {
  return { mode, countries: PAYS_ACADEMY, brands: STATS.marques, brandList: BRANDS.map(({ name, logo }) => ({ name, logo })) }
}

/**
 * Portail de l'équipe du centre de formation — une vitrine, pas une application.
 * Un seul composant pour les trois rôles (`mode` director / coordinator /
 * assistant) : l'état de la clé de répartition, les écrans ouverts par rôle
 * (droits décidés par Cerbos via /planning/access), puis les écrans à venir.
 */
export default function CenterHome({ mode = 'director' }) {
  useSiteEffects()
  const { user } = useAuth()
  const { t, locale } = useLocale('centerHome')
  // Textes des points à traiter : ceux de l'écran de la clé, pas une seconde rédaction.
  const { t: tCle } = useLocale('costKey')
  const navigate = useNavigate()
  const headerRef = useRef(null)
  // Une carte ouvre un seul écran de la clé ; la croix de cet écran ramène ici.
  const { pathname } = useLocation()
  const lienCle = (vue, query) => lienPlanning(vue, query, pathname)
  usePortalBackground(user)
  usePortalHeaderHeight(headerRef)

  const directeur = mode === 'director'
  const coordinateur = mode === 'coordinator'
  const { statut, access, annee, cle } = useEtatCle()

  if (!user) return null

  const roles = user.roles ?? []
  const points = access?.review ? cle?.points ?? [] : []
  const aTraiter = points.length
  const outils = planningMenu(access, { roles })
  // La cloche remplace « Aide ». Coordinateur : chaque point mène à la session dans la
  // fiche filiale. Directeur (observateur) : les mêmes points, en lecture seule.
  const notifications = alertesCle(directeur ? cle?.points ?? [] : points, tCle, locale,
    directeur ? null : i => navigate(lienCle('country', { annee, pays: i.country, session: i.code })))

  return (
    <>
      <Nav notifications={notifications} hideHelp />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} centerHero={chiffresHero({ mode })} />
        </div>

        {directeur && <CenterDirectorSections t={t} access={access} />}

        {/* Coordinateur : les rubriques annuelles du directeur ; les points à traiter vont dans la cloche. */}
        {coordinateur && <CenterDirectorSections t={t} access={access} sections={SECTIONS_COORDINATEUR} />}

        {!directeur && !coordinateur && (
          <>
            {/* ── 1. La clé de répartition : état et remplissage par pôle ── */}
            <PortalReveal id="cle">
              <div className="container" style={{ padding: '16px 32px' }}>
                <div className="portal-section-head">
                  <p className="portal-section-eyebrow">
                    {annee ? remplir(t.eyebrow_key, { year: annee }) : t[`role_${mode}`]}
                  </p>
                  <h2 className="portal-section-title">{t.title_key}</h2>
                </div>

                {statut === 'chargement' && (
                  <PortalSectionSkeleton cols={4} count={4} ariaLabel={t.loading_cards} />
                )}
                {statut === 'vide' && <p className="portal-empty-panel">{t.no_key}</p>}
                {statut === 'erreur' && <p className="portal-empty-panel">{t.load_error}</p>}

                {statut === 'pret' && (
                  <PortalStaggerGrid>
                    {cle && (() => {
                      const taux = cle.taux
                      const gelee = cle.statut === 'FROZEN'
                      return (
                        <div className="portal-card-anchor">
                          <PvCard
                            cardMedia={<PortalIconMedia icon="devis" tone={gelee ? 'closed' : 'progress'} />}
                            kicker={
                              <span className={`portal-status-chip ${gelee ? 'closed' : 'progress'}`}>
                                {t[`status_${cle.statut}`] ?? cle.statut}
                              </span>
                            }
                            title={remplir(t.card_year_title, { year: annee })}
                            meta={
                              <PortalCardKpis
                                items={[
                                  taux === null
                                    ? { value: cle.places, label: t.kpi_seats }
                                    : { value: cle.places, total: cle.offertes, label: t.kpi_seats },
                                  taux !== null && { value: taux, unit: '%', label: t.kpi_fill },
                                  // Même total que le portail du directeur : tout le périmètre pendant le recueil.
                                  { value: cle.repondu, total: paysAttendus({ annee, gelee: cle.statut === 'FROZEN' }, { connus: cle.connues }), label: t.kpi_answers },
                                ]}
                              />
                            }
                            cta={t.cta_pole}
                            hoverHint={t.cta_pole}
                            to={lienCle('table', { annee })}
                            corner
                          />
                        </div>
                      )
                    })()}

                    {access?.review && (
                      <div className="portal-card-anchor">
                        <PvCard
                          cardMedia={<PortalIconMedia icon="alerte" tone={aTraiter ? 'progress' : 'done'} />}
                          kicker={
                            <span className={`portal-status-chip ${aTraiter ? 'progress' : 'done'}`}>
                              {remplir(t.review_chip, { n: aTraiter })}
                            </span>
                          }
                          title={t.review_title}
                          meta={aTraiter ? t.review_meta : t.review_empty}
                          cta={aTraiter ? t.cta_review : undefined}
                          hoverHint={aTraiter ? t.cta_review : undefined}
                          accentColor={aTraiter ? ROUGE : undefined}
                          to={aTraiter ? lienCle('prepare', { annee }) : undefined}
                          corner={Boolean(aTraiter)}
                        />
                      </div>
                    )}
                  </PortalStaggerGrid>
                )}
              </div>
            </PortalReveal>

            {/* ── 2. Les écrans ouverts au rôle ─────────────────────────── */}
            <PortalReveal id="outils">
              <div className="container" style={{ padding: '16px 32px' }}>
                <div className="portal-section-head">
                  <p className="portal-section-eyebrow">{t.eyebrow_tools}</p>
                  <h2 className="portal-section-title">{t.title_tools}</h2>
                </div>
                <PortalStaggerGrid>
                  {outils.map(id => {
                    const o = OUTILS[id]
                    if (!o) return null
                    const modifiable = id === 'country' && access?.edit
                    const meta = id === 'country'
                      ? (modifiable ? t.tool_country_meta_edit : t.tool_country_meta)
                      : t[`tool_${id}_meta`]
                    return (
                      <div key={id} className="portal-card-anchor">
                        <PvCard
                          img={o.img}
                          kicker={
                            <span className={`portal-status-chip ${modifiable ? 'progress' : 'open'}`}>
                              {modifiable ? t.chip_edit : t.chip_open}
                            </span>
                          }
                          title={t[`tool_${id}`]}
                          meta={meta}
                          cta={t.cta_open}
                          hoverHint={t.cta_open}
                          to={lienCle(o.vue, { annee, ...o.query })}
                          corner
                        />
                      </div>
                    )
                  })}
                  <div className="portal-card-anchor">
                    <PvCard
                      img="/assets/img_cards/techniciens-carte.jpg"
                      kicker={<span className="portal-status-chip open">{t.chip_open}</span>}
                      title={t.tool_needs}
                      meta={t.tool_needs_meta}
                      cta={t.cta_open}
                      hoverHint={t.cta_open}
                      {...versBesoins(t.under_construction)}
                      corner
                    />
                  </div>
                </PortalStaggerGrid>
              </div>
            </PortalReveal>

            {/* ── 3. Écrans à venir, annoncés sans lien ─────────────────── */}
            <PortalReveal id="bientot">
              <div className="container" style={{ padding: '16px 32px' }}>
                <div className="portal-section-head">
                  <p className="portal-section-eyebrow">{t.eyebrow_soon}</p>
                  <h2 className="portal-section-title">{t.title_soon}</h2>
                </div>
                <PortalStaggerGrid>
                  {(BIENTOT[mode] ?? BIENTOT.director).map(id => (
                    <div key={id} className="portal-card-anchor">
                      <PvCard
                        cardMedia={<PortalConstructionMedia label={t.under_construction} />}
                        kicker={<span className="portal-status-chip todo">{t.chip_soon}</span>}
                        title={t[`soon_${id}`]}
                        meta={t[`soon_${id}_meta`]}
                      />
                    </div>
                  ))}
                </PortalStaggerGrid>
              </div>
            </PortalReveal>
          </>
        )}
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
