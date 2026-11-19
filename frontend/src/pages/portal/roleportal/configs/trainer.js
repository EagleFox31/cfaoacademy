/**
 * Portail du formateur — calqué sur celui du technicien.
 *
 *   1. Comptes rendus : les entrées du module servi à part.
 *   2. Vos prochaines sessions : ce qu'il anime bientôt (section riche).
 *   3. Formations, Tests et résultats, Certifications : en construction.
 *   4. Assistance : les demandes des techniciens sur ses marques (section riche).
 *
 * Pas de section « Vos priorités » (retirée le 18/11 à la demande).
 *
 * Constante pure : ni React, ni `data/index.js` (la navbar en dérive).
 */

/** Visuel des cartes d'entrée du module. */
const ENTREE = {
  nouveau: '/assets/publics/process-sav.jpg',
  archive: '/assets/img_cards/certification.jpg',
  brouillon: '/assets/publics/process-sav.jpg',
}

export default {
  key: 'trainer',
  ns: 'trainerHome',
  viewportSection: 'comptes-rendus',
  // Phrase chiffrée « vous formez les techniciens CFAO sur N marques ».
  header: { render: 'header' },
  assistance: null,
  construction: { label: 'under_construction', chip: 'chip_follow' },
  sections: [
    // Trois entrées, toujours présentes : commencer, reprendre, retrouver.
    { id: 'comptes-rendus', kind: 'cards', etape: 'acquerir',
      head: { eyebrow: 'cr_eyebrow', title: 'cr_title' },
      nav: { labelKey: 'nav_sec_comptes_rendus' },
      cards: [
        { id: 'nouveau', img: ENTREE.nouveau, count: null, chip: { cls: 'progress', key: 'cr_new_chip' },
          title: 'cr_new_title', meta: 'cr_new_meta', cta: 'cr_new_cta', hint: 'cr_new_hint',
          accent: '#E3001B', link: { module: '/portail/compte-rendu/nouveau' } },
        { id: 'brouillon', img: ENTREE.brouillon, count: null, chip: { cls: 'todo', key: 'cr_draft_chip' },
          title: 'cr_draft_title', meta: 'cr_draft_meta', cta: 'cr_draft_cta', hint: 'cr_draft_hint',
          link: { module: '/portail/compte-rendu/en-cours' } },
        { id: 'archive', img: ENTREE.archive, count: null, chip: { cls: 'done', key: 'cr_archive_chip' },
          title: 'cr_archive_title', meta: 'cr_archive_meta', cta: 'cr_archive_cta', hint: 'cr_archive_hint',
          link: { module: '/portail/compte-rendu/mes-rapports' } },
      ] },
    { id: 'sessions-a-venir', kind: 'rich', render: 'sessions', etape: 'acquerir',
      head: { eyebrow: 'sessions_eyebrow', title: 'sessions_title' },
      nav: { labelKey: 'nav_sec_sessions_animees' }, visibleIf: { selector: 'aVenir' } },
    { id: 'formations', kind: 'construction', etape: 'acquerir',
      head: { eyebrow: 'formations_eyebrow', title: 'formations_title' },
      nav: { labelKey: 'nav_sec_formations' },
      cards: [{ id: 'formations', title: 'formations_card', meta: 'formations_meta' }] },
    // Le formateur ne passe pas de tests : résultats des techniciens sur
    // ses marques, une carte par palier (couleurs MEDACAP).
    { id: 'competences', kind: 'construction', etape: 'mesurer',
      head: { eyebrow: 'comp_eyebrow', title: 'comp_title' },
      nav: { labelKey: 'nav_sec_competences' },
      cards: [
        { id: 'junior', title: 'results_junior_card', meta: 'results_junior_meta', accent: '#1a56db' },
        { id: 'senior', title: 'results_senior_card', meta: 'results_senior_meta', accent: '#e67e00' },
        { id: 'expert', title: 'results_expert_card', meta: 'results_expert_meta', accent: '#1aab5b' },
      ] },
    { id: 'certifs', kind: 'construction', etape: 'certifier',
      head: { eyebrow: 'certifs_eyebrow', title: 'certifs_title' },
      nav: { labelKey: 'nav_sec_certifs' },
      cards: [{ id: 'certifs', title: 'certifs_card', meta: 'certifs_meta' }] },
    // Demandes des techniciens sur ses marques : la section porte son ancre.
    { id: 'assistance', kind: 'rich', render: 'assistance', wrap: false, etape: 'appliquer',
      head: { eyebrow: 'portal:dps_assistance_eyebrow', title: 'prio_assist_title' },
      nav: { labelKey: 'nav_sec_assistance', iconKey: 'lifebuoy' } },
  ],
}
