# Fabrique de portails par rôle — plan (18/11)

## Décision

Une page unique `RolePortal`, pilotée par une config en JS pur par profil, sans React et sans `data/index.js`.
- Chaque page de rôle actuelle devient une entrée de quelques lignes : sa config, un hook de sources et ses sections riches.
- On garde le lazy loading par rôle de `Portal.jsx` (`VUES` inchangé), l'import direct de `TrainerHome` dans `SuperAdminDashboard.jsx:22` et les tests existants.

## Inventaire

| Page | Sections (ancres) | Données | À garder en section riche |
|---|---|---|---|
| TrainerHome | a-documenter, comptes-rendus, sessions-a-venir, formations, competences, certifs + assistance | mock `sessionsDuFormateur`, assistance à 0 | liste des sessions (visuel par pôle, période Intl) |
| RHHome (6 modes) | a-traiter, recrutement, competences, pif, besoins, personnes, cle | `rhDonnees` (sync) | filtres de périmètre, `CartePays`, `Progression`/`DeuxBarres`, recrutement |
| CenterHome (+ DirectorSections) | cle, outils, bientot ; directeur : besoins, devis, roi, plateforme | `useEtatCle`, `useAnnees` (async) | KPI de la clé, HomeOfferSections, `BIENTOT[mode]` |
| TeamManagerDashboard | composants `Team*` | `lms` | les 4 composants |
| DpsDashboard (observateur) | resultats, niveaux, pif, besoins-formation, assistance | `fetchMedacapCompetencyEvaluations`, `useDpsFilialeScope` | les 6 composants `Dps*` |
| KIDashboard | fad, plan, certifs, toyota-* | `useLearnerEvaluations`, `useLearnerPif`, `useKiFilialeScope` | KiPortalHero, FAD, parcours |
| LearnerDashboard | tests, resultats, pifs, formations, certifications | LMS + `LEARNER_SECTION_VISIBILITY` | tous ; passe par `PortalLayout` |
| SuperAdminDashboard (1 391 l.) | bilan, branches, competences, logs, profiles | `useDeliveryState`, stats | tout |

## Schéma de configuration

Emplacement : `frontend/src/pages/portal/roleportal/configs/<profil>.js`.

- **Profil** :
  - champs : `key`, `ns` (namespace i18n ; `portal` est toujours chargé), `observer`, `viewportSection`, `assistance`, `modes`, `sections` ;
  - `viewportSection` : id de la section qui remplit l'écran (`useAjustementEcran`) ;
  - `assistance` : `{ variant }` ou `null` ;
  - `modes` : remplace CONSULTATION_MODES et CENTER_MODES.
- **Section** :
  - champs : `id` (ancre), `etape` (dans `MEDACAP_ETAPES`, ou `null` si transverse), `head { eyebrow, title }`, `nav { labelKey, iconKey }` (absent = hors navbar), `visibleIf`, et `kind` parmi `priorities | cards | construction | rich` ;
  - `visibleIf` : `{ roles, modes, needsDetail, selector }`, où `selector` est une clé de sélecteur synchrone.
- **Carte** :
  - champs : `id`, `img` ou `media`, `chip { cls, key }`, `count`, `title`, `meta`, `metaEmpty`, `cta`, `hint`, `accent`, `link`, `visibleIf` ;
  - `count` : clé de source ; `null` = pas de nombre, `0` = pastille `done` ;
  - `link` : `{ module }`, `{ section, ifCount }`, `{ to }` ou `{ href }`.
- **i18n** : `'x'` se lit dans `ns`, `'portal:x'` dans `portal`.
- **Sources** (`roleportal/sources/<profil>.js`) :
  - `selectors` : fonctions pures `(ctx) => valeur`, avec `ctx = { user, roles, lms }` ;
  - `use<Profil>Sources(ctx)` renvoie `{ values, loading }`, mémoïsé.
- **Section riche** : `kind: 'rich', render: '<clé>'`, et l'entrée passe `rich={{ clé: Composant }}`. Le composant reçoit `{ section, t, tPortal, locale, ctx, values }`.
  - Par défaut, RolePortal pose autour `PortalReveal id`, le container et la tête de section.
  - Avec `wrap: false`, le composant porte son ancre (`Dps*`, `Team*`, `Learner*`).
  - `header: { render }` pour KiPortalHero ; `header: { props: '<sélecteur>' }` pour le hero du centre.
- **Navbar** : `roleportal/visibility.js` exporte `isVisible(node, ctx)` et `navFromConfig(config, ctx)`.
  - `PORTAL_NAV_SECTIONS.trainer` (`data/index.js:148-155`) devient `navFromConfig(trainer)`.
  - Le cas formateur de `resolvePortalNavSections` (`data/index.js:186-190`) devient générique.
  - La page et la navbar passent par le même prédicat : elles ne divergent plus.

Exemple, formateur (`configs/trainer.js`, extrait) :

```js
export default {
  key: 'trainer', ns: 'trainerHome', viewportSection: 'a-documenter',
  assistance: { variant: 'learner' },
  sections: [
    { id: 'a-documenter', kind: 'priorities', etape: null,
      head: { eyebrow: 'portal:eyebrow_next_actions', title: 'portal:title_next_actions' },
      nav: { labelKey: 'nav_sec_a_documenter' },
      cards: [
        { id: 'cr', img: IMG.cr, count: null, chip: { key: 'prio_cr_chip' }, title: 'prio_cr_title',
          meta: 'prio_cr_meta', cta: 'prio_cr_cta', link: { module: '/portail/compte-rendu/a-documenter' } },
        { id: 'sessions', img: IMG.sessions, count: 'aVenirCount', chip: { key: 'prio_sessions_chip' },
          title: 'prio_sessions_title', meta: 'prio_sessions_meta', metaEmpty: 'prio_sessions_empty',
          cta: 'prio_sessions_cta', link: { section: 'sessions-a-venir', ifCount: true } },
        { id: 'assistance', img: IMG.assist, count: 'assistanceEnAttente', chip: { key: 'prio_assist_chip' },
          title: 'prio_assist_title', meta: 'prio_assist_meta', metaEmpty: 'prio_assist_empty', cta: 'prio_assist_cta' },
        { id: 'journal', img: IMG.journal, count: null, visibleIf: { roles: ['superadmin'] },
          chip: { key: 'prio_journal_chip' }, title: 'prio_journal_title', meta: 'prio_journal_meta',
          cta: 'prio_journal_cta', link: { module: '/portail/journal-erreurs' } },
      ] },
    { id: 'comptes-rendus', kind: 'cards', etape: 'acquerir',
      head: { eyebrow: 'cr_eyebrow', title: 'cr_title' }, nav: { labelKey: 'nav_sec_comptes_rendus' },
      cards: [ /* nouveau (progress, accent), brouillon (todo), archive (done), link: { module } */ ] },
    { id: 'sessions-a-venir', kind: 'rich', render: 'sessions', etape: 'acquerir',
      head: { eyebrow: 'sessions_eyebrow', title: 'sessions_title' },
      nav: { labelKey: 'nav_sec_sessions_animees' }, visibleIf: { selector: 'aVenir' } },
    { id: 'formations', kind: 'construction', etape: 'acquerir', /* head, nav, cards */ },
    { id: 'competences', kind: 'construction', etape: 'mesurer', /* tests_card, results_card */ },
    { id: 'certifs', kind: 'construction', etape: 'certifier', /* certifs_card */ },
  ],
}
```

## Composant générique

Emplacement : `frontend/src/pages/portal/roleportal/`.
- `RolePortal.jsx` : la page.
- `RolePortalSection.jsx` : choisit le rendu selon `kind`.
- `RolePortalCard.jsx` : seul endroit qui monte PvCard. Pastille `portal-status-chip`, accent `#E3001B` si compteur, `cta`/`hint`/`corner` seulement si la carte a un lien, aucune flèche.
- `texte.js` : le `tx` de `RHHome.jsx:44`, convention `_one`.

Ce que fait RolePortal :
- le shell : Nav, StickyBar, `headerRef`, PortalHeader, Footer, DemoBar ;
- les hooks, appelés sans condition : `useSiteEffects`, `usePortalBackground(user)`, `usePortalHeaderHeight`, `useAjustementEcran` ;
- le filtrage `isVisible` ;
- avec `observer: true`, ignore `link`/`cta` et refuse `kind: 'priorities'`.

Il délègue l'en-tête à PortalHeader (ou au slot riche), les cartes à PvCard, l'assistance à PortalAssistanceSection et le contenu métier aux composants riches.

Généralisation de RHHome :
- `CONSULTATION_MODES` devient `configs/consultation.js > modes`, avec la même forme `{ perimetre, detail, profil, sections }` ;
- `SECTIONS_DE_DONNEES` devient `visibleIf: { needsDetail: true }` ;
- `portalProfiles.js:46` garde `export const CONSULTATION_MODES = consultation.modes` : `resolveProfile`, `data/index.js:130` et `portalProfiles.test.js` ne bougent pas ;
- CENTER_MODES et `BIENTOT[mode]` suivent le même chemin.

## Migration (une étape = un commit)

0. **Caractérisation, sans changer de code** : `TrainerHome.snapshot.test.jsx` (`innerHTML` en fr, en et pt, mêmes mocks que `TrainerHome.test.jsx`) et `portalNav.parity.test.js` (`PORTAL_NAV_SECTIONS` figé en littéral pour tous les rôles).
1. **Socle, sans toucher aux pages** :
   - fichiers : `roleportal/{RolePortal,RolePortalSection,RolePortalCard}.jsx`, `visibility.js`, `schema.js` (`MEDACAP_ETAPES`, `validateConfig`), `texte.js` ;
   - tests : `RolePortal.test.jsx` (config factice : ancres, construction sans `<a>`, slot riche, `visibleIf.roles`, observateur sans CTA) et `schema.test.js`.
2. **Pilote formateur** :
   - fichiers : `configs/trainer.js`, `sources/trainer.js`, `sections/TrainerSessionsSection.jsx` (actuelles lignes 271-298) ;
   - `TrainerHome.jsx` devient `<RolePortal config rich useSources />`, et la nav est dérivée dans `data/index.js` ;
   - tests : `TrainerHome.test.jsx` inchangé et vert, snapshot et parité verts, plus `roleConfigs.test.js` (clés présentes en fr, en et pt via `getCopy`, ids uniques, `etape` valide).
3. **Consultation (RHHome)** :
   - en config : `besoins`, `cle`, cartes macro en construction ;
   - restent riches : `a-traiter`, `recrutement`, `competences`/`pif` détaillés, `personnes` ;
   - nouveau `RHHome.test.jsx` : ancres égales à la nav pour les 7 rôles.
   - **FAIT (18/11, non commité)** : `configs/consultation.js` (une config, `visibleIf.modes` = rôles de `CONSULTATION_MODES`), `sources/consultation.js` (`perimetreDuMode`, `useConsultationSources`), `sections/ConsultationSections.jsx` ; `RHHome.jsx` = `<RolePortal mode detail …/>`. Schéma étendu : `visibleIf.detail` (`false` = seulement sans vue détaillée), même id permis pour des sections exclusives (`exclusives()` : modes disjoints ou vue détaillée opposée), carte `icon` (PortalIconMedia) et `link.to` en vrai lien, `mode`/`detail` dans `ctx`, matrice qui lit `visibleIf.modes`. Nav des 7 rôles dérivée par `navFromConfig`, `PORTAL_CONFIGS` couvre les 7 rôles. Écart visuel assumé : résultats/PIF macro et besoins prennent le visuel de chantier de la fabrique (au lieu de photo ou icône + surimpression) ; la carte de la clé perd le gabarit à hauteur fixe. Preuves : 68 tests portail + roleportal + data, 128 admin + i18n.
4. **Centre** : `cle` reste riche, `outils` et `bientot` passent en cartes, les sections directeur sont riches. `CenterHome.test.js` doit rester vert.
5. **Chef d'équipe / d'atelier** : sections riches `wrap: false`, modes `team` et `workshop`.
6. **DPS/DOP** : `observer: true`, sections riches. `validateConfig` refuse `link` et `cta`, avec un test.
7. **KI/PIC** : en-tête riche, modale dans le composant riche.
8. **Apprenant** : `LEARNER_SECTION_VISIBILITY` devient des sélecteurs `lms`. Attention à `PortalLayout`/`usePortalReveal`.
9. **Super admin** : en dernier, en sections riches seulement ; l'enjeu est la nav dérivée.

À chaque étape : `vite build` et `vitest --reporter=dot` dans Docker.

## Risques et pièges

- **Bundle et cycle d'import** : `data/index.js` est importé par les pages publiques. Les configs et les sélecteurs n'importent ni React, ni composant, ni `data/index.js`. Comparer la taille du chunk d'entrée avant et après.
- **Lazy loading** : pas de lazy par section riche (cascade de chargements). L'entrée du rôle importe ses riches en statique.
- **Hooks de fond** :
  - `usePortalBackground` reste dans la page (Portal le retire au démontage) ;
  - vérifier que `useAjustementEcran` tolère une ref nulle ;
  - ne pas passer par `PortalLayout` avant l'étape 8 : son `usePortalReveal` re-tague les `div[id]`.
- **Compteurs asynchrones** :
  - `undefined` = en chargement (squelette), `null` = pas de nombre, `0` = pastille `done` ;
  - la visibilité dans la nav ne dépend que de sélecteurs synchrones ;
  - mémoïser `values` (leçon du 05/11 : un objet en dépendance relançait l'effet en boucle) ; les configs sont des constantes de module.
- **Mocks des tests** : RolePortal importe les composants par les mêmes chemins (`../../components/PvCard`, `PortalReveal.jsx`…), sinon les mocks ne s'appliquent plus. `useLocale` : deux appels fixes (`ns` et `portal`).
- **Rendu identique** : dans le pilote, garder `style={{ padding: '16px 32px' }}` et `portal-card-anchor`. La bascule vers une classe CSS se fait dans un commit à part.
- **i18n** : `validateConfig` échoue sur une clé absente dans une langue.
- **Doublon** : `data/index.js:73` redéfinit `getPrimaryRole`. Le retirer dans un commit à part.

## Ensuite : gestion des portails (super admin)

La matrice profils × sections s'édite depuis une carte « Gestion des portails » du portail super admin. Le détail est dans `PASSATION.md` (18/11).

## Réserves reçues (18/11, session clé de répartition) et suite retenue

1. **Mini-langage pour peu de gain** : DPS, KI, apprenant, super admin et chef d'équipe passent presque tout en sections riches. Après les étapes 2 à 4, mesurer la part de code réellement passée en config. Si elle est faible, s'arrêter au socle commun (`RolePortal`, `RolePortalCard`, `isVisible`, `navFromConfig`).
2. **Manques du schéma**, vus sur le centre (commits 8355eae, 5defe8a, 5b6e593) :
   - cartes générées depuis une source (une carte par année de l'API) : champ `cardsFrom: '<source>'` ;
   - cloche à la place de « Aide » (`<Nav notifications hideHelp />`, `alertesCle()`) : champ de profil `notifications: '<source>'`, en lecture seule pour un observateur.
3. **`TrainerHome.snapshot.test.jsx`** : utile pendant la migration, à supprimer une fois la bascule faite.
4. **Matrice éditable du super admin** : la limiter à afficher ou masquer une section par profil, sans toucher au contenu.

Suite : étapes 3 et 4 (RH, centre), puis point d'étape avec la mesure du point 1 avant de décider des étapes 5 à 9 et de la matrice.

## Portails validés (19/11/2026)

Structure (sections, ordre) et libellés validés par le métier. Ils ne bougent plus sans validation.

- **Ce qui les fige** : `frontend/src/pages/portal/portailsValides.test.jsx`. Il rend chaque portail en fr, en et pt, puis compare le titre d'accueil et, section par section, l'ancre, le surtitre et le titre à la capture `__snapshots__/portailsValides.test.jsx.snap`. Les onglets de navigation sont figés à part par `portalNav.parity`.
- **Changer un libellé ou une section** : d'abord la validation de l'utilisateur. Ensuite, relancer le test avec `-u`, puis mettre à jour le tableau ci-dessous. Un test rouge sans validation signale une régression à corriger, pas une capture à régénérer.
- **Le français fait foi ci-dessous** ; l'anglais et le portugais sont dans la capture.

| Portail | Sections dans l'ordre (ancre : titre) |
|---|---|
| Directeur du centre de formation (`CenterHome`) | besoins : Identification annuelle des besoins en formations · devis : Devis filiale · offres, formations-equipment, formations-carrosserie, formations-sav-motors, formations-sav-equipment : les 5 offres de formation · calendrier : Calendrier annuel de formation · rapports : Rapports de formations · roi : Retour sur investissement de l'Academy · plateforme : État d'avancement de la plateforme |
| DPS (`DpsDashboard`) | besoins-formation : Identification Annuelle des besoins en formations de votre filiale · resultats : Compétences de vos Equipes par marques · niveaux : Compétences des techniciens par niveau · pif : Plans de formations pluriannuels de vos techniciens · assistance : Assistance |
| Formateur (`TrainerHome`) | comptes-rendus : Vos comptes rendus de sessions de formation · formations : Formations à dispenser · competences : Résultats des techniciens · certifs : Certifications de vos stagiaires · assistance : Assistance aux techniciens |
| RH filiale (`RHHome mode="branch_hr"`) | recrutement : Recrutement · competences : Résultats de vos techniciens par niveau · pif : Plans de formations pluriannuels de vos techniciens · besoins : Identification annuelle des besoins en formation · personnes : Techniciens et candidats |

Points ouverts, figés tels quels en attendant une décision :

- **Section « Formateurs » du directeur** : volontairement masquée en attendant sa refonte (une carte par formateur ne tient pas à 100 formateurs). `CenterTrainerLoad.jsx` et l'API restent en place.
- **Traductions manquantes (DPS)** : le titre `besoins-formation` reste en français en anglais et en portugais, tout comme le titre `niveaux` en portugais. Les traduire est une modification validée à faire avec `-u`.
