import { useEffect, useState } from 'react'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalSectionSkeleton from '../../components/PortalSectionSkeleton.jsx'
import PvCard from '../../components/PvCard'
import PortalConstructionMedia from '../../components/PortalConstructionMedia.jsx'
import PortalCardKpis from '../../components/PortalCardKpis.jsx'
import HomeOfferSections from '../../components/HomeOfferSections.jsx'
import { planningApi } from '../../lib/planningApi.js'
import { PLANNING_HOME } from '../../utils/planningAccess.js'
import { baseBesoins } from '../../utils/urlBesoins.js'

/** Ancres de la page, dans l'ordre : la navigation du directeur s'y aligne. */
export const SECTIONS_DIRECTEUR = ['besoins', 'devis', 'offres', 'calendrier', 'rapports', 'roi', 'plateforme']

const PLATEFORME = ['site', 'support', 'reports']

/**
 * Un visuel différent par année, pour que deux cartes voisines ne se confondent
 * pas. Les visuels des besoins sont ceux des campagnes du portail DPS.
 */
const VISUELS = {
  besoins: [
    '/assets/formation_motorisation_centre_formation.jpg',
    '/assets/technicien_multibrand.jpg',
    '/assets/technicien_equipment.jpg',
  ],
  devis: [
    '/assets/img_cards/process_pieces_motors.png',
    '/assets/img_cards/process_pieces_equipment.png',
    '/assets/img_cards/clients-carte.jpg',
  ],
}
const visuel = (rubrique, i) => VISUELS[rubrique][i % VISUELS[rubrique].length]

/**
 * Titre d'une carte annuelle, l'année colorée selon le code des pastilles
 * d'année du portail DPS : à venir en bleu, en cours en vert, passée en gris.
 */
function titreAnnee(texte, annee) {
  const courante = new Date().getFullYear()
  const temps = annee > courante ? 'future' : annee === courante ? 'current' : 'past'
  const [avant, apres = ''] = texte.split('{year}')
  return <>{avant}<span className={`portal-card-year portal-card-year--${temps}`}>{annee}</span>{apres}</>
}

/** Ce qu'une année dit au directeur, tous pôles confondus. */
export function syntheseAnnee(g) {
  const reponses = g?.responses ?? []
  const codes = champ => new Set(reponses.flatMap(r => r[champ] ?? [])).size
  const totaux = Object.values(g?.brand_totals ?? {})
  return {
    annee: g.year,
    gelee: g.status === 'FROZEN',
    repondu: codes('answered'),
    connus: codes('known'),
    besoins: totaux.reduce((n, m) => n + (m.needs ?? 0), 0),
    places: g.total_seats ?? 0,
    filiales: g.rows?.length ?? 0,
    marques: (g.brands ?? []).map(b => ({
      code: b.code,
      label: b.label,
      besoins: g.brand_totals?.[b.code]?.needs ?? 0,
      places: g.brand_totals?.[b.code]?.seats ?? 0,
    })),
  }
}

/**
 * État du recueil des besoins d'une année. Les besoins de l'année N se
 * recueillent avant N : dès que l'exercice a commencé, ou que la clé est gelée,
 * le recueil est clos, même si des pays n'ont jamais répondu.
 */
export function statutBesoins(a, anneeCourante = new Date().getFullYear()) {
  if (a.gelee || a.annee <= anneeCourante) return { chip: 'closed', cle: 'chip_closed' }
  if (a.connus > 0 && a.repondu >= a.connus) return { chip: 'done', cle: 'chip_complete' }
  return { chip: 'progress', cle: 'chip_ongoing' }
}

/**
 * Une synthèse par année de clé, de la plus récente à la plus ancienne. Chaque
 * année s'affiche dès que sa réponse arrive, sans attendre les autres.
 */
function useAnnees() {
  const [etat, setEtat] = useState({ statut: 'chargement', annees: [] })

  useEffect(() => {
    let actif = true
    ;(async () => {
      try {
        const cles = await planningApi.keys()
        const liste = Array.isArray(cles) ? cles : cles?.results ?? []
        const millesimes = [...new Set(liste.map(c => c.year))].sort((a, b) => b - a)
        const recues = []
        await Promise.all(millesimes.map(async a => {
          const g = await planningApi.yearGlobal(a).catch(() => null)
          if (!g || !actif) return
          recues.push(syntheseAnnee(g))
          recues.sort((x, y) => y.annee - x.annee)
          setEtat({ statut: 'pret', annees: [...recues] })
        }))
        if (actif && !recues.length) setEtat({ statut: 'vide', annees: [] })
      } catch {
        if (actif) setEtat({ statut: 'erreur', annees: [] })
      }
    })()
    return () => { actif = false }
  }, [])

  return etat
}

function Section({ id, t, children }) {
  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t[`dir_${id}_eyebrow`]}</p>
          <h2 className="portal-section-title">{t[`dir_${id}_title`]}</h2>
        </div>
        {children}
      </div>
    </PortalReveal>
  )
}

function Etat({ statut, t }) {
  if (statut === 'chargement') return <PortalSectionSkeleton cols={4} count={4} ariaLabel={t.loading_cards} />
  if (statut === 'vide') return <p className="portal-empty-panel">{t.no_key}</p>
  if (statut === 'erreur') return <p className="portal-empty-panel">{t.load_error}</p>
  return null
}

const aSuivre = t => <span className="portal-status-chip todo">{t.chip_follow}</span>

/**
 * Les sept rubriques du directeur du centre. Les trois premières lisent les
 * applications existantes (besoins, clé de répartition) ; les suivantes
 * annoncent ce qui reste à construire, sans lien.
 */
export default function CenterDirectorSections({ t, access }) {
  const { statut, annees } = useAnnees()
  const millesimes = annees.length ? annees.map(a => a.annee) : [new Date().getFullYear()]

  return (
    <>
      <Section id="besoins" t={t}>
        <Etat statut={statut} t={t} />
        <PortalStaggerGrid>
          {annees.map((a, i) => {
            const etat = statutBesoins(a)
            return (
              <div key={a.annee} className="portal-card-anchor">
                <PvCard
                  img={visuel('besoins', i)}
                  kicker={
                    <span className={`portal-status-chip ${etat.chip}`}>{t[etat.cle]}</span>
                  }
                  title={titreAnnee(t.dir_besoins_card, a.annee)}
                  meta={
                    <PortalCardKpis
                      items={[
                        { value: a.repondu, total: a.connus, label: t.kpi_countries },
                        { value: a.besoins, label: t.kpi_needs },
                      ]}
                    />
                  }
                  cta={t.cta_open}
                  hoverHint={t.cta_open}
                  onClick={() => window.location.assign(baseBesoins())}
                  corner
                />
              </div>
            )
          })}
        </PortalStaggerGrid>
      </Section>

      <Section id="devis" t={t}>
        <Etat statut={statut} t={t} />
        <PortalStaggerGrid>
          {annees.map((a, i) => (
            <div key={a.annee} className="portal-card-anchor">
              <PvCard
                img={visuel('devis', i)}
                kicker={
                  <span className={`portal-status-chip ${a.gelee ? 'closed' : 'progress'}`}>
                      {a.gelee ? t.chip_closed : access?.edit ? t.chip_edit : t.status_DRAFT}
                    </span>
                }
                title={titreAnnee(t.dir_devis_card, a.annee)}
                meta={
                  <PortalCardKpis
                    items={[
                      { value: a.filiales, label: t.kpi_branches },
                      { value: a.places, label: t.kpi_seats },
                    ]}
                  />
                }
                cta={t.cta_open}
                hoverHint={t.cta_open}
                to={`${PLANNING_HOME}/country?annee=${a.annee}&pays=all`}
                corner
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </Section>

      <HomeOfferSections backdrop={false} />

      {['calendrier', 'rapports'].map(id => (
        <Section key={id} id={id} t={t}>
          <PortalStaggerGrid>
            {millesimes.map(annee => (
              <div key={annee} className="portal-card-anchor">
                <PvCard
                  cardMedia={<PortalConstructionMedia label={t.under_construction} />} kicker={aSuivre(t)}
                  title={titreAnnee(t[`dir_${id}_card`], annee)}
                  meta={t[`dir_${id}_meta`]}
                />
              </div>
            ))}
          </PortalStaggerGrid>
        </Section>
      ))}

      <Section id="roi" t={t}>
        <PortalStaggerGrid>
          <div className="portal-card-anchor">
            <PvCard cardMedia={<PortalConstructionMedia label={t.under_construction} />} kicker={aSuivre(t)} title={t.dir_roi_card} meta={t.dir_roi_meta} />
          </div>
        </PortalStaggerGrid>
      </Section>

      <Section id="plateforme" t={t}>
        <PortalStaggerGrid>
          {PLATEFORME.map(id => (
            <div key={id} className="portal-card-anchor">
              <PvCard
                cardMedia={<PortalConstructionMedia label={t.under_construction} />} kicker={aSuivre(t)}
                title={t[`dir_plateforme_${id}`]}
                meta={t[`dir_plateforme_${id}_meta`]}
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </Section>
    </>
  )
}
