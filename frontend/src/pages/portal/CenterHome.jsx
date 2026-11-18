import { useEffect, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
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
import CenterDirectorSections, { PAYS_ACADEMY, syntheseAnnee } from './CenterDirectorSections.jsx'

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
  coordinator: ['fill', 'sessions', 'convocations', 'trainers'],
  assistant: ['sessions', 'convocations', 'fill'],
}

const remplir = (texte, valeurs) =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), texte)

/** Taux de remplissage = places attribuées / places mises à disposition (null sans capacité saisie). */
export function tauxRemplissage(places, offertes) {
  if (!offertes) return null
  return Math.round((places / offertes) * 100)
}

/**
 * La clé d'une année, tous pôles confondus : une seule carte par année.
 * Places et places offertes s'additionnent ; une filiale qui a répondu pour
 * Motors et pour Equipment ne compte qu'une fois (syntheseAnnee).
 * `g` : synthèse de l'année (/years/{année}/global), null si elle n'a pas pu être lue.
 */
export function etatAnnee(clesAnnee, g) {
  const offres = clesAnnee.map(c => c.seats_offered).filter(v => v != null)
  const synthese = g ? syntheseAnnee(g) : null
  const toutesGelees = clesAnnee.length > 0 && clesAnnee.every(c => c.status === 'FROZEN')
  return {
    statut: g?.status ?? (toutesGelees ? 'FROZEN' : 'DRAFT'),
    places: g?.total_seats ?? 0,
    offertes: offres.length ? offres.reduce((n, v) => n + v, 0) : null,
    repondu: synthese?.repondu ?? 0,
    connues: synthese?.connus ?? 0,
    points: g?.review_items ?? [],
  }
}

/**
 * Charge la clé de la dernière année (synthèse tous pôles) : état, places,
 * réponses des filiales, points à traiter. Sans `detail` (page du directeur,
 * qui a ses propres rubriques), seuls les droits sont lus : pas d'appel dont
 * le résultat ne serait pas affiché.
 */
function useEtatCle(detail = true) {
  const [etat, setEtat] = useState({ statut: 'chargement', access: null, annee: null, cle: null })

  useEffect(() => {
    let actif = true
    ;(async () => {
      try {
        if (!detail) {
          const access = await planningApi.access()
          if (actif) setEtat({ statut: 'pret', access, annee: null, cle: null })
          return
        }
        const [access, cles] = await Promise.all([planningApi.access(), planningApi.keys()])
        const liste = Array.isArray(cles) ? cles : cles?.results ?? []
        if (!liste.length) {
          if (actif) setEtat({ statut: 'vide', access, annee: null, cle: null })
          return
        }
        const annee = Math.max(...liste.map(c => c.year))
        const g = await planningApi.yearGlobal(annee).catch(() => null)
        if (actif) setEtat({ statut: 'pret', access, annee, cle: etatAnnee(liste.filter(c => c.year === annee), g) })
      } catch {
        if (actif) setEtat({ statut: 'erreur', access: null, annee: null, cle: null })
      }
    })()
    return () => { actif = false }
  }, [detail])

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
  const { statut, access, annee, cle } = useEtatCle(!directeur)

  if (!user) return null

  const roles = user.roles ?? []
  const points = access?.review ? cle?.points ?? [] : []
  const aTraiter = points.length
  const outils = planningMenu(access, { roles })
  // La cloche remplace « Aide » : chaque point mène à la session concernée dans la fiche filiale.
  const notifications = points.flatMap(i => {
    const text = reviewText(tCle, locale, i)
    return text
      ? [{ id: i.id, label: `${i.country_label} · ${i.code}`, text, cta: tCle.review_open,
        onOpen: () => navigate(lienCle('country', { annee, pays: i.country, session: i.code })) }]
      : []
  })

  return (
    <>
      <Nav notifications={notifications} hideHelp />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} centerHero={chiffresHero({ mode })} />
        </div>

        {directeur && <CenterDirectorSections t={t} access={access} />}

        {!directeur && (
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
                      const taux = tauxRemplissage(cle.places, cle.offertes)
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
                                  { value: cle.repondu, total: cle.connues, label: t.kpi_answers },
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
