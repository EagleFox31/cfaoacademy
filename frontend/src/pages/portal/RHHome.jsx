import { useMemo, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PvCard from '../../components/PvCard'
import PortalIconMedia from '../../components/PortalIconMedia.jsx'
import { drapeauUrl } from '../../utils/drapeau.js'
import { PLANNING_HOME } from '../../utils/planningAccess.js'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import { CONSULTATION_MODES } from './portalProfiles.js'
import {
  BU, PERIMETRE_GROUPE, filiales, priorites,
  syntheseRecrutement, syntheseCompetences, synthesePIF, synthesePersonnes,
} from '../../utils/rhDonnees'

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

/** Texte traduit : remplace les {variables} et prend `cle_one` quand n <= 1
 * (meme convention que les sections DPS). */
function tx(t, cle, vars = {}) {
  const modele = (vars.n != null && vars.n <= 1 && t[`${cle}_one`]) || t[cle] || ''
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v ?? '—'), modele)
}

/** Libelle une priorite de `priorites()` (code + chiffres) dans la langue. */
function libellerPriorite(t, a) {
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

/** Photo de carte, a la hauteur commune. */
function Photo({ src }) {
  return (
    <div className="pv-card-img" style={{ height: HAUTEUR_VISUEL }}>
      <img src={src} alt="" loading="lazy" />
    </div>
  )
}

/** Le drapeau en visuel de carte, traite comme les heros du portail :
 * voile marine en degrade (fonce a gauche, plus leger a droite) et nom
 * du pays en blanc par-dessus. Le drapeau reste lisible sans dominer. */
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

/** Barre de progression du portail, a la couleur du statut. Les couleurs
 * sont fixees : la carte reste claire, meme dans une section sombre. */
function Progression({ libelle, valeur, droite, attente }) {
  const couleur = attente ? 'var(--muted)' : etat(valeur)[3]
  return (
    <div className="portal-progress-block" style={{ margin: 0 }}>
      <div className="portal-progress-head" style={{ marginBottom: 6 }}>
        <span className="portal-progress-lbl" style={{ color: 'var(--navy)', fontSize: 13 }}>{libelle}</span>
        {droite && <span className="portal-progress-pct" style={{ color: couleur, fontSize: 13 }}>{droite}</span>}
      </div>
      <div className="portal-progress-track" style={{ background: 'var(--rule)' }}>
        <div className="portal-progress-fill" style={{ width: `${attente ? 0 : valeur ?? 0}%`, background: couleur }} />
      </div>
    </div>
  )
}

/** Deux barres cote a cote : deux chiffres sur la hauteur d'une seule. */
function DeuxBarres({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
}

/**
 * Carte de l'accueil RH : `PvCard` a gabarit fixe, pour que toutes les
 * cartes de la page aient la meme hauteur — visuel de hauteur commune,
 * puce de statut, titre sur deux lignes reservees, contenu sur la hauteur
 * d'une barre ou de deux lignes de texte, ligne d'action.
 */
function Carte({ img, media, statut, titre, contenu, action, survol, accent, to }) {
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
        to={to}
        corner
      />
    </div>
  )
}

/** Puce de statut. */
const Puce = ({ cls, children }) => <span className={`portal-status-chip ${cls}`}>{children}</span>

/** Carte d'un pays : drapeau en visuel, statut de couverture, chiffre cle
 * en titre, une barre de progression. */
function CartePays({ t, f, titre, contenu }) {
  const [, cls, libelle] = etat(f.couverture)
  return (
    <Carte media={<VisuelPays f={f} />} statut={<Puce cls={cls}>{t[libelle]}</Puce>}
      titre={titre} contenu={contenu} action={t.cta_country} survol={t.cta_country} />
  )
}

/** Titre de section du portail. */
function TeteSection({ surtitre, titre }) {
  return (
    <div className="portal-section-head">
      <p className="portal-section-eyebrow">{surtitre}</p>
      <h2 className="portal-section-title">{titre}</h2>
    </div>
  )
}

/**
 * Accueil RH — vue groupe.
 *
 * Meme rythme que les autres portails : entete, ce qui attend une action,
 * puis une section par espace, dans l'ordre du cycle RH — recruter,
 * mesurer, former, gerer les personnes. Chaque section resume son espace
 * et y mene ; les espaces eux-memes viendront ensuite.
 *
 * Le perimetre (filiale, BU) s'applique a toute la page. La RH groupe le
 * choisit ; la RH filiale aura sa filiale fixee (`filialeFixe`).
 *
 * `mode` (role) choisit les sections : RH groupe, directeur groupe, admin
 * groupe, directeur regional, directeur de filiale (CONSULTATION_MODES).
 * Hors perimetre groupe, resultats et PIF sont des cartes en construction.
 */
export default function RHHome({ filialeFixe = null, mode = 'group_hr' }) {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('consultation')
  const headerRef = useRef(null)
  usePortalBackground(user)
  const { perimetre: portee, sections } = CONSULTATION_MODES[mode] ?? CONSULTATION_MODES.group_hr
  const montre = id => sections.includes(id)
  const groupe = portee === 'groupe'

  const [perimetre, setPerimetre] = useState({ ...PERIMETRE_GROUPE, filiale: filialeFixe })
  const changer = patch => setPerimetre(p => ({ ...p, ...patch }))

  // Seules les priorites des sections ouvertes au role remontent.
  const aTraiter = useMemo(() => priorites(perimetre)
    .filter(a => sections.includes(a.espace))
    .map(a => ({ ...a, ...libellerPriorite(t, a) })), [perimetre, sections, t])
  const recrutement = useMemo(() => syntheseRecrutement(perimetre), [perimetre])
  // Les chiffres des cartes Recrutement : ouvertes d'un cote, cloturees de l'autre.
  const { enCours, terminees } = useMemo(() => {
    const somme = (liste, cle) => liste.reduce((n, c) => n + c[cle], 0)
    const ouvertes = recrutement.campagnes.filter(c => c.statut === 'ouverte')
    const closes = recrutement.campagnes.filter(c => c.statut !== 'ouverte')
    const notees = closes.filter(c => c.moyenne != null && c.testes)
    return {
      enCours: {
        nombre: ouvertes.length,
        candidats: somme(ouvertes, 'candidats'),
        testes: somme(ouvertes, 'testes'),
        avancement: Math.round(100 * somme(ouvertes, 'testes') / (somme(ouvertes, 'candidats') || 1)),
      },
      terminees: {
        nombre: closes.length,
        candidats: somme(closes, 'candidats'),
        testes: somme(closes, 'testes'),
        moyenne: notees.length
          ? Math.round(notees.reduce((n, c) => n + c.moyenne * c.testes, 0) / somme(notees, 'testes'))
          : null,
      },
    }
  }, [recrutement])
  const competences = useMemo(() => syntheseCompetences(perimetre), [perimetre])
  const pif = useMemo(() => synthesePIF(perimetre), [perimetre])
  const personnes = useMemo(() => synthesePersonnes(perimetre), [perimetre])

  if (!user) return null

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} />
        </div>

        {/* ── Ce qui attend une action ─────────────────────────── */}
        {montre('a-traiter') && <PortalReveal id="a-traiter">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.todo_eyebrow}</p>
              <h2 className="portal-section-title">{t.todo_title}</h2>
            </div>
            <div className="portal-plan-filters portal-plan-filters--compact" role="group" aria-label={t.scope_label}>
              {!filialeFixe && (
                <label className="portal-plan-filter-field">
                  <span>{t.filter_branch}</span>
                  <select disabled value={perimetre.filiale ?? ''}
                    onChange={e => changer({ filiale: e.target.value || null })}>
                    <option value="">{t.filter_all_branches}</option>
                    {filiales().map(f => <option key={f.code} value={f.code}>{f.pays}</option>)}
                  </select>
                </label>
              )}
              <label className="portal-plan-filter-field">
                <span>{t.filter_bu}</span>
                <select disabled value={perimetre.bu ?? ''} onChange={e => changer({ bu: e.target.value || null })}>
                  <option value="">{t.filter_all_bu}</option>
                  {BU.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            </div>

            {aTraiter.length > 0 ? (
              <PortalStaggerGrid>
                {aTraiter.map(a => (
                  <Carte key={a.code} img={VISUEL[a.espace]}
                    statut={<Puce cls="progress">{a.nature}</Puce>}
                    titre={a.titre} contenu={a.detail} accent="#E3001B"
                    action={t.cta_treat} survol={t.hint_treat} />
                ))}
              </PortalStaggerGrid>
            ) : (
              <p className="portal-plan-filter-empty">{t.todo_empty}</p>
            )}
          </div>
        </PortalReveal>}

        {/* ── Recrutement : campagnes et exploitation ──────────── */}
        {montre('recrutement') && <PortalReveal id="recrutement">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={t.rec_eyebrow} titre={t.rec_title} />
            <PortalStaggerGrid>
              <Carte img={VISUEL.personnes} statut={<Puce cls="todo">{t.rec_new_chip}</Puce>}
                titre={t.rec_new_title}
                contenu={t.rec_new_card}
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
                    {/* Le score n'est publie qu'a la cloture de la campagne. */}
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
          </div>
        </PortalReveal>}

        {/* ── Hors groupe : résultats et PIF en vue macro, en construction ── */}
        {!groupe && ['results', 'pif'].map(cle => (
          <PortalReveal key={cle} id={cle === 'results' ? 'competences' : 'pif'}>
            <div className="container" style={{ padding: '16px 32px' }}>
              <TeteSection surtitre={t[`${cle}_eyebrow`] ?? t[`${cle}_eyebrow_${portee}`]} titre={t[`${cle}_title`]} />
              <PortalStaggerGrid>
                <Carte img={cle === 'results' ? VISUEL.competences : VISUEL.pif}
                  statut={<Puce cls="todo">{t.chip_follow}</Puce>}
                  titre={t[`${cle}_card`]} contenu={t[`${cle}_meta_${portee}`]} action={t.chip_follow} />
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        ))}

        {/* ── Compétences : mesure et exploitation ─────────────── */}
        {groupe && montre('competences') && <PortalReveal id="competences">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={competences.campagne?.intitule ?? t.comp_eyebrow}
              titre={t.comp_title} />
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
          </div>
        </PortalReveal>}

        {/* ── PIF : par filiale et par BU ──────────────────────── */}
        {groupe && montre('pif') && <PortalReveal id="pif">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={t.pif_eyebrow} titre={t.pif_group_title} />
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
          </div>
        </PortalReveal>}

        {/* ── Techniciens & candidats : fiches, import, corbeille ─────────────── */}
        {montre('personnes') && <PortalReveal id="personnes">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={t.people_eyebrow} titre={t.people_title} />
            <PortalStaggerGrid>
              <Carte img="/assets/img_cards/test_theorie_senior.jpg" statut={<Puce cls="todo">{t.people_add_chip}</Puce>}
                titre={t.people_add_title}
                contenu={t.people_add_card}
                accent="#E3001B" action={t.people_add_cta} survol={t.people_add_hint} />
              <Carte img="/assets/img_cards/test_theorie_expert.jpg"
                statut={<Puce cls="progress">{tx(t, 'people_active', { n: personnes.candidats })}</Puce>}
                titre={t.people_candidates_title}
                contenu={t.people_candidates_card}
                action={t.people_manage_cta} survol={t.people_candidates_hint} />
              <Carte img={VISUEL.personnes}
                statut={<Puce cls="done">{tx(t, 'people_active', { n: personnes.techniciens })}</Puce>}
                titre={t.people_techs_title}
                contenu={<Progression libelle={t.bar_complete}
                  valeur={Math.round(100 * (personnes.techniciens - personnes.aCompleter) / (personnes.techniciens || 1))}
                  droite={`${personnes.techniciens - personnes.aCompleter}/${personnes.techniciens}`} />}
                action={t.people_manage_cta} survol={t.people_techs_hint} />
              <Carte img="/assets/img_cards/test_pratique_expert.jpg"
                statut={<Puce cls="todo">{tx(t, 'people_bin_chip', { n: personnes.supprimes })}</Puce>}
                titre={t.people_bin_title}
                contenu={t.people_bin_card}
                action={t.people_bin_cta} survol={t.people_bin_hint} />
            </PortalStaggerGrid>
          </div>
        </PortalReveal>}

        {/* ── Clé de répartition : en consultation, périmètre décidé par Cerbos ── */}
        {montre('cle') && <PortalReveal id="cle">
          <div className="container" style={{ padding: '16px 32px' }}>
            <TeteSection surtitre={t.cle_eyebrow} titre={t.cle_title} />
            <PortalStaggerGrid>
              <Carte media={<PortalIconMedia icon="devis" tone="open" />}
                statut={<Puce cls="open">{t.chip_read}</Puce>}
                titre={t.cle_card} contenu={t[`cle_meta_${portee}`]}
                action={t.cta_cle} survol={t.cta_cle} to={PLANNING_HOME} />
            </PortalStaggerGrid>
          </div>
        </PortalReveal>}

      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
