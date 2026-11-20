import PortalStaggerGrid from '../../../../components/PortalStaggerGrid.jsx'
import PvCard from '../../../../components/PvCard'
import { drapeauUrl } from '../../../../utils/drapeau.js'
import { TierScoreCard } from '../../../../components/DpsTierResultsSection.jsx'
import { PIF_YEARS } from '../../../../utils/learnerPif.js'
import { tx } from '../texte.js'

/**
 * Sections riches du portail de consultation (configs/consultation.js) :
 * À traiter, Recrutement, Résultats et PIF par filiale, Techniciens et
 * candidats. Chiffres du jeu RH (sources/consultation.js).
 */

/** Visuel des cartes, par espace. */
const VISUEL = {
  recrutement: '/assets/img_cards/test_theorie_junior.jpg',
  competences: '/assets/img_cards/test_pratique_senior.jpg',
  pif: '/assets/img_cards/certification.jpg',
  personnes: '/assets/publics/techniciens.jpg',
}

/** Seuils et couleurs des statuts : puces du portail (`portal-status-chip`
 * done / progress / todo) et couleurs de docs/PORTAL_COLORIMETRY.md
 * (vert fait, orange en cours, rouge non fait). */
const ETAT = [
  [80, 'done', 'state_done', '#1aab5b'],
  [50, 'progress', 'state_progress', '#e67e00'],
  [0, 'todo', 'state_late', 'var(--red)'],
]
const etat = valeur => ETAT.find(([seuil]) => (valeur ?? 0) >= seuil)

/** Libelle une priorité de `priorites()` (code + chiffres) dans la langue. */
export function libellerPriorite(t, a) {
  switch (a.code) {
    case 'rec_open': return {
      nature: tx(t, 'rec_open_nature', { n: a.nombre }),
      titre: a.nombre > 1 ? tx(t, 'rec_open_title', { n: a.nombre }) : a.intitule,
      detail: tx(t, 'rec_open_detail', { n: a.sansTest })
        + (a.nombre > 1 ? '' : tx(t, 'rec_open_detail_suffix', { branch: a.filiale, pct: a.avancement })),
    }
    case 'rec_results': return {
      nature: t.rec_results_nature, titre: a.intitule,
      detail: tx(t, 'rec_results_detail', { tested: a.testes, avg: a.moyenne }),
    }
    case 'measure_late': {
      const [f] = a.filiales
      return {
        nature: t.measure_late_nature,
        titre: a.nombre > 1
          ? tx(t, 'measure_late_title', { n: a.nombre })
          : tx(t, 'measure_late_title_one', { country: f.pays, pct: f.couverture }),
        detail: a.nombre > 1
          ? a.filiales.slice(0, 3).map(x => `${x.pays} ${x.couverture} %`).join(' · ')
          : tx(t, 'measure_late_detail_one', { done: f.evalues, total: f.techniciens }),
      }
    }
    case 'pif_pending': return {
      nature: t.pif_pending_nature,
      titre: tx(t, 'pif_pending_title', { n: a.attente }),
      detail: tx(t, 'pif_pending_detail', { done: a.valides, total: a.proposes }),
    }
    default: return {
      nature: t.records_incomplete_nature,
      titre: tx(t, 'records_incomplete_title', { n: a.nombre }),
      detail: t.records_incomplete_detail,
    }
  }
}

/** Hauteur commune des visuels de carte, photos comme drapeaux. */
const HAUTEUR_VISUEL = 150

/** Photo de carte, à la hauteur commune. */
function Photo({ src }) {
  return (
    <div className="pv-card-img" style={{ height: HAUTEUR_VISUEL }}>
      <img src={src} alt="" loading="lazy" />
    </div>
  )
}

/** Le drapeau en visuel de carte, traité comme les heros du portail :
 * voile marine en dégradé et nom du pays en blanc par-dessus. */
function VisuelPays({ f }) {
  return (
    <div className="pv-card-img" style={{ position: 'relative', height: HAUTEUR_VISUEL, background: '#0e1126' }}>
      <img src={drapeauUrl(f.code)} alt="" loading="lazy"
        style={{ filter: 'saturate(0.9)' }} />
      <span aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(105deg, rgba(14,17,38,0.72) 0%, rgba(14,17,38,0.42) 50%, rgba(14,17,38,0.12) 100%)',
      }} />
      <div style={{ position: 'absolute', left: 20, right: 60, bottom: 16, color: '#fff', pointerEvents: 'none' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{f.pays}</div>
      </div>
    </div>
  )
}

/** Barre de progression du portail, à la couleur du statut. */
function Progression({ libelle, valeur, droite, attente }) {
  const couleur = attente ? 'var(--muted)' : etat(valeur)[3]
  return (
    <div className="portal-progress-block" style={{ margin: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Libellé et chiffre calés en haut, barre en bas : deux barres voisines restent alignées. */}
      <div className="portal-progress-head" style={{ marginBottom: 6, flex: 1 }}>
        <span className="portal-progress-lbl" style={{ color: 'var(--navy)', fontSize: 13 }}>{libelle}</span>
        {droite && <span className="portal-progress-pct" style={{ color: couleur, fontSize: 13 }}>{droite}</span>}
      </div>
      <div className="portal-progress-track" style={{ background: 'var(--rule)' }}>
        <div className="portal-progress-fill" style={{ width: `${attente ? 0 : valeur ?? 0}%`, background: couleur }} />
      </div>
    </div>
  )
}

/** Deux barres côte à côte : deux chiffres sur la hauteur d'une seule. */
function DeuxBarres({ children }) {
  // Colonnes de même hauteur : libellés alignés en haut, barres alignées en bas.
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>{children}</div>
}

/**
 * Carte à gabarit fixe, pour que toutes les cartes de la page aient la même
 * hauteur : visuel de hauteur commune, puce de statut, titre sur deux lignes
 * réservées, contenu sur la hauteur d'une barre ou de deux lignes de texte.
 */
function Carte({ img, media, statut, titre, contenu, action, survol, accent }) {
  return (
    <div className="portal-card-anchor">
      <PvCard
        cardMedia={media ?? <Photo src={img} />}
        kicker={statut}
        title={<span style={{ display: 'block', minHeight: '2.3em' }}>{titre}</span>}
        meta={<div style={{ minHeight: 42 }}>{contenu}</div>}
        accentColor={accent}
        cta={action}
        hoverHint={survol}
        corner={Boolean(action)}
      />
    </div>
  )
}

/** Puce de statut. */
const Puce = ({ cls, children }) => <span className={`portal-status-chip ${cls}`}>{children}</span>

/** Carte d'un pays : drapeau, statut de couverture, chiffre clé, une barre. */
function CartePays({ t, f, titre, contenu }) {
  const [, cls, libelle] = etat(f.couverture)
  return (
    <Carte media={<VisuelPays f={f} />} statut={<Puce cls={cls}>{t[libelle]}</Puce>}
      titre={titre} contenu={contenu} action={t.cta_country} survol={t.cta_country} />
  )
}

/** Ce qui attend une action : une carte par priorité. */
export function ATraiterSection({ t, values }) {
  const { aTraiter } = values
  return (
    <>
      {aTraiter.length > 0 ? (
        <PortalStaggerGrid>
          {aTraiter.map(a => {
            const l = libellerPriorite(t, a)
            return (
              <Carte key={a.code} img={VISUEL[a.espace]}
                statut={<Puce cls="progress">{l.nature}</Puce>}
                titre={l.titre} contenu={l.detail} accent="#E3001B"
                action={t.cta_treat} survol={t.hint_treat} />
            )
          })}
        </PortalStaggerGrid>
      ) : (
        <p className="portal-plan-filter-empty">{t.todo_empty}</p>
      )}
    </>
  )
}

/** Recrutement : nouvelle campagne, campagnes en cours, campagnes terminées. */
export function RecrutementSection({ t, values }) {
  const { enCours, terminees } = values
  return (
    <PortalStaggerGrid>
      <Carte img={VISUEL.personnes} statut={<Puce cls="todo">{t.rec_new_chip}</Puce>}
        titre={t.rec_new_title} contenu={t.rec_new_card}
        accent="#E3001B" action={t.rec_new_cta} survol={t.rec_new_hint} />
      <Carte img={VISUEL.recrutement}
        statut={<Puce cls={enCours.nombre ? 'progress' : 'todo'}>
          {enCours.nombre ? tx(t, 'rec_running_chip', { n: enCours.nombre }) : t.rec_running_none}
        </Puce>}
        titre={t.rec_running_title}
        contenu={enCours.nombre ? (
          <DeuxBarres>
            <Progression libelle={t.bar_tested} valeur={enCours.avancement}
              droite={`${enCours.testes}/${enCours.candidats}`} />
            {/* Le score n'est publié qu'à la clôture de la campagne. */}
            <Progression libelle={t.bar_score} attente droite={t.score_pending} />
          </DeuxBarres>
        ) : t.rec_running_empty}
        action={t.rec_running_cta} survol={t.rec_running_hint} />
      <Carte img={VISUEL.competences}
        statut={<Puce cls="done">{tx(t, 'rec_closed_chip', { n: terminees.nombre })}</Puce>}
        titre={t.rec_closed_title}
        contenu={terminees.nombre ? (
          <DeuxBarres>
            <Progression libelle={t.bar_tested}
              valeur={Math.round(100 * terminees.testes / (terminees.candidats || 1))}
              droite={`${terminees.testes}/${terminees.candidats}`} />
            <Progression libelle={t.bar_score} valeur={terminees.moyenne}
              droite={terminees.moyenne != null ? `${terminees.moyenne} %` : '—'} />
          </DeuxBarres>
        ) : t.rec_closed_empty}
        action={t.rec_closed_cta} survol={t.rec_closed_hint} />
    </PortalStaggerGrid>
  )
}

/** En-tête d'une section riche qui choisit son titre selon la portée. */
function Entete({ surtitre, titre }) {
  return (
    <div className="portal-section-head">
      <p className="portal-section-eyebrow">{surtitre}</p>
      <h2 className="portal-section-title">{titre}</h2>
    </div>
  )
}

/** Niveaux du jeu RH → libellés métier (mêmes cartes que le portail DPS). */
const NIVEAU_METIER = [
  ['Junior', 'junior', 'level_maintenance'],
  ['Senior', 'senior', 'level_repair'],
  ['Expert', 'expert', 'level_diagnostic'],
]

/** Carte en construction : la donnée n'existe pas encore. Même gabarit et
 * même enveloppe que `Carte`, pour rester alignée avec elle dans une rangée. */
function CarteChantier({ t, titre, contenu }) {
  return (
    <div className="portal-card-anchor">
      <PvCard enConstruction={t.under_construction}
        kicker={<Puce cls="todo">{t.chip_follow}</Puce>}
        title={<span style={{ display: 'block', minHeight: '2.3em' }}>{titre}</span>}
        meta={<div style={{ minHeight: 42 }}>{contenu}</div>} />
    </div>
  )
}

/**
 * Résultats de compétences. Filiale : une carte par niveau de technicien ;
 * groupe : une carte par filiale. Le surtitre suit la campagne en cours.
 */
export function CompetencesSection({ t, values }) {
  const { competences, filialeFixe } = values
  const surtitre = competences.campagne?.intitule ?? t.comp_eyebrow
  if (filialeFixe) {
    return (
      <>
        <Entete surtitre={surtitre} titre={t.comp_title_filiale} />
        <PortalStaggerGrid>
          {NIVEAU_METIER.map(([niveau, tierKey, cle]) => {
            const n = competences.parNiveau.find(x => x.niveau === niveau)
            return (
              <TierScoreCard key={niveau} tierKey={tierKey} label={t[cle]}
                avgScore={n.moyenne} evaluatedCount={n.evalues} techniciansCount={n.techniciens}
                avgLabel={t.comp_avg} noScoreLabel={t.comp_no_score}
                evaluatedLabel={t.bar_evaluated.toLowerCase()} />
            )
          })}
        </PortalStaggerGrid>
      </>
    )
  }
  return (
    <>
      <Entete surtitre={surtitre} titre={t.comp_title} />
      {competences.parFiliale.length > 0 && (
        <PortalStaggerGrid>
          {competences.parFiliale.map(f => (
            <CartePays key={f.code} t={t} f={f}
              titre={f.moyenne != null ? tx(t, 'comp_score', { pct: f.moyenne }) : t.comp_no_score}
              contenu={<Progression libelle={t.bar_evaluated} valeur={f.couverture}
                droite={`${f.evalues}/${f.techniciens}`} />} />
          ))}
        </PortalStaggerGrid>
      )}
    </>
  )
}

/**
 * PIF. Filiale : le PIF pluriannuel (chiffres MEDACAP), puis une carte par
 * année, en construction tant que MEDACAP ne donne pas les PIF par année.
 * Groupe : une carte par filiale.
 */
export function PifSection({ t, values }) {
  const { pif, filialeFixe } = values
  if (filialeFixe) {
    const pct = (n, total) => Math.round(100 * n / (total || 1))
    return (
      <>
        <Entete surtitre={t.pif_eyebrow} titre={t.pif_filiale_title} />
        <PortalStaggerGrid>
          <Carte img={VISUEL.pif}
            statut={<Puce cls={etat(pif.couverture)[1]}>{t[etat(pif.couverture)[2]]}</Puce>}
            titre={t.pif_pluri_title}
            contenu={(
              <DeuxBarres>
                <Progression libelle={t.bar_with_pif} valeur={pif.couverture}
                  droite={`${pif.avecPif}/${pif.techniciens}`} />
                <Progression libelle={t.bar_pif_validated} valeur={pct(pif.valides, pif.avecPif)}
                  droite={`${pif.valides}/${pif.avecPif}`} />
              </DeuxBarres>
            )} />
          {PIF_YEARS.map(annee => (
            <CarteChantier key={annee} t={t}
              titre={tx(t, 'pif_year_title', { year: annee })}
              contenu={tx(t, 'pif_year_meta', { year: annee })} />
          ))}
        </PortalStaggerGrid>
      </>
    )
  }
  return (
    <>
      <Entete surtitre={t.pif_eyebrow} titre={t.pif_group_title} />
      {pif.parFiliale.length > 0 && (
        <PortalStaggerGrid>
          {pif.parFiliale.map(f => (
            <CartePays key={f.code} t={t} f={f}
              titre={f.valides ? tx(t, 'pif_validated', { n: f.valides }) : t.pif_none}
              contenu={<Progression libelle={t.bar_with_pif} valeur={f.couverture}
                droite={`${f.avecPif}/${f.techniciens}`} />} />
          ))}
        </PortalStaggerGrid>
      )}
    </>
  )
}

/**
 * Identification annuelle des besoins : une carte par campagne (année
 * prochaine, en cours, précédente), en construction tant qu'aucune donnée
 * de besoins n'est branchée.
 */
export function BesoinsSection({ t }) {
  const annee = new Date().getFullYear()
  return (
    <PortalStaggerGrid>
      {[annee + 1, annee, annee - 1].map(a => (
        <CarteChantier key={a} t={t}
          titre={tx(t, 'needs_card', { year: a })}
          contenu={tx(t, 'needs_meta', { year: a })} />
      ))}
    </PortalStaggerGrid>
  )
}

/** Techniciens et candidats : ajout, candidats, techniciens, corbeille. */
export function PersonnesSection({ t, values }) {
  const { personnes } = values
  return (
    <PortalStaggerGrid>
      <Carte img="/assets/img_cards/test_theorie_senior.jpg" statut={<Puce cls="todo">{t.people_add_chip}</Puce>}
        titre={t.people_add_title} contenu={t.people_add_card}
        accent="#E3001B" action={t.people_add_cta} survol={t.people_add_hint} />
      <Carte img="/assets/img_cards/test_theorie_expert.jpg"
        statut={<Puce cls="progress">{tx(t, 'people_candidates_count', { n: personnes.candidats })}</Puce>}
        titre={t.people_candidates_title} contenu={t.people_candidates_card}
        action={t.people_manage_cta} survol={t.people_candidates_hint} />
      <Carte img={VISUEL.personnes}
        statut={<Puce cls="done">{tx(t, 'people_techs_count', { n: personnes.techniciens })}</Puce>}
        titre={t.people_techs_title}
        contenu={<Progression libelle={t.bar_complete}
          valeur={Math.round(100 * (personnes.techniciens - personnes.aCompleter) / (personnes.techniciens || 1))}
          droite={`${personnes.techniciens - personnes.aCompleter}/${personnes.techniciens}`} />}
        action={t.people_manage_cta} survol={t.people_techs_hint} />
      <Carte img="/assets/img_cards/test_pratique_expert.jpg"
        statut={<Puce cls="todo">{tx(t, 'people_bin_chip', { n: personnes.supprimes })}</Puce>}
        titre={t.people_bin_title} contenu={t.people_bin_card}
        action={t.people_bin_cta} survol={t.people_bin_hint} />
    </PortalStaggerGrid>
  )
}
