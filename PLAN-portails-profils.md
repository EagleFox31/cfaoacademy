# Plan : portails des autres profils sur la fabrique (20/11)

Exigences : hero norme DPS (phrase chiffrée en grand, « — » sans donnée), KPI propres via `components/PortalHeroKpis.jsx`, wording métier propre (AGENTS.md §6b), fr/en/pt, aucune fausse donnée, figer dans `portailsValides` + registre `fabrique-portails.md` SEULEMENT après validation de l'utilisateur, matrice `docs/engineering/matrice-sections-portail.html` mise à jour à chaque passe.

## A. État et écart par profil

| Profil | Fabrique | Écart principal |
|---|---|---|
| Coordinateur (`CenterHome` coordinator) | non | KPI `rapprochees` à `null` alors que `planningApi.trainerLoad(annee)` donne `close_sessions` (vérifier Cerbos : `trainer-load` réservé au directeur → sinon « — ») ; `rapportsAttendus` sans source ; pas figé |
| Chef d'équipe / d'atelier (`TeamManagerDashboard`) | non | mock `LMS_BY_USER[demoKey]` seul, `return null` pour un vrai compte (l.27-28) ; repli inventé « CAMEROON MOTORS » dans `hooks/useManagerScope.js:56-99` ; hero sans phrase ni filiale (`PortalGreetingBlock.jsx:319`) ; nav sans ancres réelles |
| KI / PIC (`KIDashboard`) | non | ancres Toyota en dur ; `learnersAssessed: stat.technicians ?? 0` (`utils/kiScope.js:59`) = 0 inventé ; pas de KPI ; nav incomplète |
| Apprenant (`LearnerDashboard`) | non (`PortalLayout`) | repli `LMS_BY_USER.u9` pour tout compte réel (l.25) ; chaînes FR en dur (titres, modales) ; petite phrase grise |
| RH groupe, admin groupe, directeur groupe | oui | pas de KPI ; matrice périmée (drg, adg en P alors que la vue détaillée existe) |
| Directeur régional | oui | phrase sans jeton |
| Directeur de filiale | oui | phrase sans chiffre ; MEDACAP `fetchDpsScope` donne marques + techniciens |
| Admin filiale | oui (profil branch_hr) | pas de KPI ; pas figé |
| Candidat | — | aucun rôle (retombe sur apprenant) : créer un rôle = changement d'accès, décision de l'utilisateur. Hors passes |
| Super admin | non | sélecteur de BU en FR en dur (`PortalHeader.jsx:225-265`) ; nav à la main ; en dernier |

## B. Propositions (fr, à faire valider)

| Profil | Phrase du hero | KPI (source) | Sections |
|---|---|---|---|
| Coordinateur | inchangée | filiales à relancer, points devis (réels) ; sessions rapprochées (`trainerLoad`, si Cerbos l'ouvre) ; rapports non reçus « — » | besoins · devis · calendrier · rapports · administration |
| Chef d'équipe | « Vous encadrez {techs} techniciens CFAO sur {marques} marques » | techniciens sans évaluation (`managerScope.kpis.alertCount`, GET /api/v1/core/manager/scope) ; plans à valider « — » | equipe (mesurer) · resultats (exploiter) · plans (définir) · assistance ; next-actions mocké retiré |
| Chef d'atelier | « Vous dirigez un atelier de {techs} techniciens CFAO sur {marques} marques » | sans évaluation (`alertCount`) ; évalués (`scoredCount`/`totalCount`) | equipes · resultats · plans · besoins (chantier) · assistance |
| KI | « Vous formez {techs} techniciens {marque} de votre filiale » | sessions à animer (`lms.formationsADispenser.length`) ; pas encore évalués (`kiScope`, `null` pas 0) | fad · resultats · pif · tests · plan · parcours · certifs |
| PIC | « Vous coordonnez la formation de {techs} techniciens de votre filiale » | idem KI | idem, nav `pic` réalignée |
| Apprenant | « Vous intervenez sur {marques} marques, avec {certifs} certifications obtenues » | tests à passer (`useLearnerEvaluations`) ; formations prévues (`useLearnerPif().planPathway`) | tests · resultats · pifs · formations · certifications |
| RH groupe | inchangée | non évalués → competences ; sans plan → pif ; fiches à compléter → personnes (`rhDonnees`) | inchangées |
| Admin groupe | inchangée | fiches → personnes ; plans pas encore validés → pif | competences · pif · personnes · cle |
| Directeur groupe (observateur) | inchangée | % évalués, % avec plan (format `pct`, ton neutre) | competences · pif · cle |
| Directeur régional (observateur) | « Votre région compte {techs} techniciens CFAO dans {filiales} filiales » (« — ») | aucun | competences (chantier) · pif (chantier) · cle |
| Directeur de filiale (observateur) | « Votre filiale compte {techs} techniciens CFAO sur {marques} marques » (MEDACAP) | aucun | idem |
| Admin filiale | inchangée | fiches → personnes ; campagnes ouvertes → recrutement | 5 sections RH filiale + cle |
| Super admin | « Vous administrez la plateforme pour {learners} techniciens dans {filiales} filiales sur {marques} marques » (`api.groupStats`) | services en alerte (`supervisionApi.overview`, à vérifier) ; points devis | bilan · console · branches · competences · logs · profiles |

## C. Ordre des passes
1. Consultation (6 profils) — 2. Coordinateur — 3. Managers — 4. KI/PIC — 5. Apprenant — 6. Super admin.

### Passe 1 : consultation
1. `components/PortalHeroKpis.jsx:14-26` : `k.format === 'pct'` → « 42 % », ton neutre ; comportement actuel inchangé.
2. `roleportal/configs/consultation.js` : constante `heroKpis` par mode (`{ id, label, valeur, cible, format? }`) : group_hr (nonEvalues→competences, sansPlan→pif, fichesACompleter→personnes) ; group_admin (fichesACompleter→personnes, plansAValider→pif) ; branch_admin (fichesACompleter→personnes, campagnesOuvertes→recrutement) ; group_director (pctEvalues, pctPlans en `pct`). **Rien pour branch_hr** (validé).
3. `roleportal/sources/consultation.js:48-62` : champs à plat `nonEvalues`, `sansPlan`, `plansAValider`, `fichesACompleter`, `campagnesOuvertes` (= enCours.nombre), `pctEvalues` (= competences.couverture), `pctPlans` (= pif.couverture) ; `null` hors vue détaillée. Vérifier les noms réels des champs dans `utils/rhDonnees`.
4. `hooks/useMarquesFiliale.js:22-24` : exposer aussi le nombre de techniciens MEDACAP (lire `mergeScopePayload`, `utils/medacapDpsScopeApi.js:48`) ; garder l'ancien hook en alias pour ne pas toucher branch_hr ; `null` si inconnu.
5. `roleportal/sections/ConsultationHeader.jsx` : recevoir `t` (ns consultation) ET `tPortal` ; branch_director → techs/marques MEDACAP ; regional_director → techs/filiales `null` + mots au pluriel ; `belowGreeting={heroKpis[mode] ? <PortalHeroKpis kpis t values/> : null}` ; ne pas importer `data/index.js`.
6. i18n : `portal.json` fr/en/pt : réécrire `consult_hero_regional_director` et `consult_hero_branch_director` (phrases ci-dessus) ; `consultation.json` fr/en/pt : `kpi_not_assessed`, `kpi_no_plan`, `kpi_records_incomplete`, `kpi_plans_to_approve`, `kpi_recruit_open` (+ `_one`, `_zero`), `kpi_pct_assessed`, `kpi_pct_planned`.
7. `roleportal/schema.js` (`validateConfig`) : vérifier labels (+ `_one`/`_zero` hors pct) dans les 3 langues et `cible` = id de section ; test dans `schema.test.js`.
8. Tests : `RHHome.test.jsx:77-84` (regional_director : chiffres `{techs:null, filiales:null,…}`) ; `it.each` modes → `HEADER.props.belowGreeting?.props.kpis` ; branch_hr sans `belowGreeting` ; test pct de PortalHeroKpis ; **portailsValides vert sans `-u`**.
9. Matrice : PROFILES `drg`, `adg` → `'demo'`, `dfi` → `'part'` ; ROWS résultats/PIF : drg, adg `['L','groupe']` ; « À traiter » rhg/adg → `X` (remplacé par les chiffres du hero) ; nouvelle famille `['Accueil']` + ligne « Chiffres du hero » (rhg 3, adg 2, drg 2 en %, rhf X validé sans chiffres, coo 4, ass 3) ; 4ᵉ élément `etape` par ligne affiché en `<small>`.
10. Preuves : vitest ciblé (portal, roleportal, data, i18n) dans `cfao-front-front-1` ; `vite build` = conteneur partagé → prévenir manitou + verrou.

## D. Pièges
- `portailsValides.test.jsx.snap` : tout écart sur branch_hr = régression ; ne jamais passer de KPI à branch_hr via branch_admin (même `profil`).
- `data/portalNav.parity.test.js` cassera aux passes 3-4 (réalignement nav) : `-u` justifié à mentionner.
- `PortalHeroKpis` lit `t[k.label]` : passer le `t` du ns consultation ; `ConsultationHeader` déstructure aujourd'hui `tPortal: t`.
- `RHHome.test.jsx` mocke `PortalHeader` : lire `belowGreeting.props.kpis`.
- Observateurs : format `pct` neutre, pas d'orange « reste à faire », pas de CTA.
- `_zero` obligatoire pour les compteurs.
- pt `portal_orient_*` (pt/portal.json:624-631) = français mêlé : à traduire ou retirer aux passes 3-5.
- Passe 3 : retirer le repli inventé de `useManagerScope` (erreur → `scope: null`) ; aussi utilisé par `ManagerDashboard.jsx` ; ajouter `managerHero` à `filialeSuffix`.
- Passe 5 : `PortalLayout`/`usePortalReveal` re-tague les `div[id]` ; `LEARNER_SECTION_VISIBILITY` (data/index.js:161).
- Candidat : rien sans accord de l'utilisateur (changement d'accès).
