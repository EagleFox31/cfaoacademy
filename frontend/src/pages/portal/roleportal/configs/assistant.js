/**
 * Portail de l'assistante du centre (`center_assistant`), validé le 19/11
 * (docs/engineering/cadrage-portail-assistante.md) :
 *
 *   1. Prochaines sessions de formation : une fiche par session des 2
 *      prochaines semaines (section riche).
 *   2. Vos dossiers : Salles · Stagiaires · Logistique · Invitations ·
 *      Attestations, dans l'ordre du travail. En construction tant qu'aucune
 *      donnée n'existe (pas de fausses données).
 *   3. À consulter : calendrier de l'année (en construction) et part de
 *      chaque filiale (clé de répartition, en lecture).
 *
 * Constante pure : ni React, ni `data/index.js` (la navbar en dérive).
 */

/** Tableau de la clé de répartition, ouvert seul avec retour au portail.
 * Même adresse que `lienPlanning('table', {}, '/portail')`
 * (utils/planningAccess.js importe data/index.js : l'importer ici bouclerait).
 * Égalité vérifiée par AssistantHome.test. */
export const PART_DES_FILIALES = '/portail/cle-repartition/table?retour=%2Fportail'

export default {
  key: 'assistant',
  ns: 'assistantHome',
  // Phrase chiffrée du centre : « vous préparez les formations de N pays ».
  header: { render: 'header' },
  // Cloche des alertes à la place du menu d'aide (même navbar que le centre).
  cloche: true,
  // Chiffres cliquables sous la phrase du hero : ce qui risque de mal tourner,
  // et la carte où elle agit (valeurs dans `sources/assistant.js`).
  heroKpis: [
    { id: 'a-preparer', valeur: 'aPreparer', label: 'kpi_sessions', cible: 'prochaines-sessions' },
    { id: 'sans-voyage', valeur: 'sansVoyage', label: 'kpi_travel', cible: 'dossiers-logistique' },
    { id: 'invitations', valeur: 'invitationsAEnvoyer', label: 'kpi_invites', cible: 'dossiers-invitations' },
  ],
  construction: { label: 'under_construction', chip: 'chip_follow' },
  sections: [
    { id: 'prochaines-sessions', kind: 'rich', render: 'sessions', etape: 'acquerir',
      head: { eyebrow: 'sessions_eyebrow', title: 'sessions_title' },
      nav: { labelKey: 'nav_sec_assist_sessions', iconKey: 'graduationcap' } },
    // Le moment (avant, pendant, après) se range dans chaque dossier.
    { id: 'dossiers', kind: 'construction', etape: 'acquerir',
      head: { eyebrow: 'files_eyebrow', title: 'files_title' },
      nav: { labelKey: 'nav_sec_assist_dossiers', iconKey: 'clipboard' },
      cards: [
        { id: 'salles', title: 'rooms_card', meta: 'rooms_meta' },
        { id: 'stagiaires', title: 'trainees_card', meta: 'trainees_meta' },
        // `ancre` : cible des chiffres du hero (id `dossiers-<id>`).
        { id: 'logistique', ancre: true, title: 'travel_card', meta: 'travel_meta' },
        { id: 'invitations', ancre: true, title: 'invites_card', meta: 'invites_meta' },
        { id: 'attestations', title: 'certificates_card', meta: 'certificates_meta' },
      ] },
    { id: 'a-consulter', kind: 'cards', etape: 'acquerir',
      head: { eyebrow: 'lookup_eyebrow', title: 'lookup_title' },
      nav: { labelKey: 'nav_sec_assist_consulter', iconKey: 'sliders' },
      cards: [
        { id: 'calendrier', construction: true, title: 'calendar_card', meta: 'calendar_meta' },
        // Refacturation : elle la consulte, le coordinateur et le directeur la modifient.
        { id: 'part-filiales', icon: 'devis', count: null, chip: { cls: 'open', key: 'chip_read' },
          title: 'shares_card', meta: 'shares_meta', cta: 'cta_consult',
          link: { to: PART_DES_FILIALES } },
      ] },
  ],
}
