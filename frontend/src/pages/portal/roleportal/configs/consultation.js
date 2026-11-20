/**
 * Portail de consultation (RH, directions, admins groupe et filiale) : une
 * seule config pour les 7 rôles de `CONSULTATION_MODES`, le mode = le rôle.
 *
 *   1. À traiter, Recrutement : chiffres du jeu RH (vue détaillée seulement).
 *   2. Résultats et PIF : en vue détaillée, par niveau et par année pour une
 *      filiale, par filiale pour le groupe ; sinon en construction (vue
 *      macro, texte selon la portée région ou filiale).
 *   3. Besoins en formation : une carte par campagne annuelle, en construction.
 *   4. Techniciens et candidats : chiffres du jeu RH (vue détaillée).
 *   5. Clé de répartition : en consultation, texte selon la portée.
 *
 * Vue détaillée (`detail`) : périmètre groupe, ou filiale de l'utilisateur
 * connue (RH et admin filiale). Constante pure : la navbar en dérive.
 */
import { CONSULTATION_MODES } from '../../portalProfiles.js'

/** Rôles qui ont cette section, avec cette portée si elle est donnée. */
const modesAvec = (id, portee) => Object.keys(CONSULTATION_MODES).filter(m =>
  CONSULTATION_MODES[m].sections.includes(id) && (!portee || CONSULTATION_MODES[m].perimetre === portee))

/** Même chemin que `PLANNING_HOME` (utils/planningAccess.js, qui importe
 * data/index.js : l'importer ici bouclerait). Égalité vérifiée par RHHome.test. */
export const CLE_REPARTITION = '/portail/cle-repartition'

/** Résultats ou PIF en vue macro, pour une portée (région ou filiale). */
const macro = (id, cle, portee, eyebrow, etape) => ({
  id, kind: 'construction', etape,
  head: { eyebrow, title: `${cle}_title` },
  nav: { labelKey: `nav_sec_rh_${id}`, iconKey: id === 'pif' ? 'milestone' : 'award' },
  visibleIf: { modes: modesAvec(id, portee), detail: false },
  cards: [{ id, title: `${cle}_card`, meta: `${cle}_meta_${portee}` }],
})

/**
 * Chiffres sous la phrase du hero, propres à chaque rôle (PortalHeroKpis) :
 * ce qui reste à faire, un clic descend à la section. Directeur groupe
 * (observateur) : des taux, sans « reste à faire ». Rien pour la RH filiale
 * (portail validé tel quel), ni pour les directeurs régional et de filiale.
 */
export const HERO_KPIS = {
  group_hr: [
    { id: 'non-evalues', valeur: 'nonEvalues', label: 'kpi_not_assessed', cible: 'competences' },
    { id: 'sans-plan', valeur: 'sansPlan', label: 'kpi_no_plan', cible: 'pif' },
    { id: 'fiches', valeur: 'fichesACompleter', label: 'kpi_records_incomplete', cible: 'personnes' },
  ],
  group_admin: [
    { id: 'fiches', valeur: 'fichesACompleter', label: 'kpi_records_incomplete', cible: 'personnes' },
    { id: 'plans-a-valider', valeur: 'plansAValider', label: 'kpi_plans_to_approve', cible: 'pif' },
  ],
  branch_admin: [
    { id: 'fiches', valeur: 'fichesACompleter', label: 'kpi_records_incomplete', cible: 'personnes' },
    { id: 'campagnes', valeur: 'campagnesOuvertes', label: 'kpi_recruit_open', cible: 'recrutement' },
  ],
  group_director: [
    { id: 'pct-evalues', valeur: 'pctEvalues', label: 'kpi_pct_assessed', cible: 'competences', format: 'pct' },
    { id: 'pct-plans', valeur: 'pctPlans', label: 'kpi_pct_planned', cible: 'pif', format: 'pct' },
  ],
}

export default {
  key: 'consultation',
  ns: 'consultation',
  // Phrase chiffrée du métier de chaque rôle (norme DPS / centre).
  header: { render: 'header' },
  heroKpis: HERO_KPIS,
  construction: { label: 'under_construction', chip: 'chip_follow' },
  sections: [
    { id: 'a-traiter', kind: 'rich', render: 'aTraiter', etape: null,
      head: { eyebrow: 'todo_eyebrow', title: 'todo_title' },
      visibleIf: { modes: modesAvec('a-traiter'), needsDetail: true } },
    { id: 'recrutement', kind: 'rich', render: 'recrutement', etape: 'mesurer',
      head: { eyebrow: 'rec_eyebrow', title: 'rec_title' },
      nav: { labelKey: 'nav_sec_rh_recrutement', iconKey: 'star' },
      visibleIf: { modes: modesAvec('recrutement'), needsDetail: true } },
    macro('competences', 'results', 'region', 'results_eyebrow_region', 'mesurer'),
    macro('competences', 'results', 'filiale', 'results_eyebrow_filiale', 'mesurer'),
    macro('pif', 'pif', 'region', 'pif_eyebrow', 'definir'),
    macro('pif', 'pif', 'filiale', 'pif_eyebrow', 'definir'),
    // Vue détaillée : par niveau (filiale) ou par filiale (groupe). Le titre
    // suit la portée et le surtitre la campagne : la section riche porte son en-tête.
    { id: 'competences', kind: 'rich', render: 'competences', etape: 'mesurer',
      nav: { labelKey: 'nav_sec_rh_competences', iconKey: 'award' },
      visibleIf: { modes: modesAvec('competences'), needsDetail: true } },
    { id: 'pif', kind: 'rich', render: 'pif', etape: 'definir',
      nav: { labelKey: 'nav_sec_rh_pif', iconKey: 'milestone' },
      visibleIf: { modes: modesAvec('pif'), needsDetail: true } },
    // Une carte par campagne annuelle, en construction tant qu'aucune donnée.
    { id: 'besoins', kind: 'rich', render: 'besoins', etape: 'definir',
      head: { eyebrow: 'needs_eyebrow', title: 'needs_title' },
      nav: { labelKey: 'nav_sec_dir_besoins', iconKey: 'listtodo' },
      visibleIf: { modes: modesAvec('besoins') } },
    { id: 'personnes', kind: 'rich', render: 'personnes', etape: null,
      head: { eyebrow: 'people_eyebrow', title: 'people_title' },
      nav: { labelKey: 'nav_sec_rh_personnes', iconKey: 'users' },
      visibleIf: { modes: modesAvec('personnes'), needsDetail: true } },
    // Places et devis en consultation : périmètre décidé par Cerbos.
    { id: 'cle', kind: 'cards', etape: 'acquerir',
      head: { eyebrow: 'cle_eyebrow', title: 'cle_title' },
      nav: { labelKey: 'nav_sec_centre_cle', iconKey: 'sliders' },
      visibleIf: { modes: modesAvec('cle') },
      cards: ['groupe', 'region', 'filiale'].map(portee => ({
        id: portee, icon: 'devis', count: null, chip: { cls: 'open', key: 'chip_read' },
        title: 'cle_card', meta: `cle_meta_${portee}`, cta: 'cta_cle',
        link: { to: CLE_REPARTITION }, visibleIf: { modes: modesAvec('cle', portee) },
      })) },
  ],
}
