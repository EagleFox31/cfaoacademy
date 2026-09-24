# Portail RH — analyse et plan

Profils visés : `branch_hr` (RH filiale) et `group_hr` (RH groupe).
Source fonctionnelle : MEDACAP2026 (PHP + MongoDB `academy`), profil « Ressource Humaine ».

---

## 1. L'existant

### 1.1 MEDACAP2026 — ce que voit le profil « Ressource Humaine »

Le menu est construit depuis la base (`profiles.functionalities`), pas dans le code.
Le profil RH a **8 fonctionnalités** (4 comptes RH en base) :

| Groupe MEDACAP | Fonctionnalité | Page |
|---|---|---|
| Bilan des tests | État d'avancement des campagnes de recrutement | `measure/candidats.php` |
| Paramètres | Importer des candidats | `measure/importCandidat.php` |
| Bilan des évaluations | Résultats des techniciens par niveau | `explore/results` |
| Bilan des évaluations | Résultats des techniciens par marque | `explore/userSubsidiaryResult` |
| État d'avancement | État d'avancement agence | `stateAgency` |
| Planning des tests | Planning des tests des filiales | `calendar` |
| Planning de formation | Planning des formations | `planning` |
| — | Tableau de bord RH (accueil) | `measure/dashboardRh.php` |

Existe dans MEDACAP mais **fermé au profil RH** :

- **PIF** : `define/services/PIFService.php`, `pifdashboard.php`. Les indicateurs sont :
  - techniciens évalués (Factuel + Déclaratif validé manager) ;
  - techniciens avec PIF (au moins une allocation `Training`) ;
  - PIF validés.
- **CRUD collaborateurs** (profil Admin) :
  - `measure/createCollaborator.php` (2 250 lignes) ;
  - `measure/editDeletCollaborator.php` (3 900 lignes).

Le tableau de bord RH (`dashboardRh.php`) couvre une **seule campagne de recrutement à la fois** :

- total, candidats testés, avancement, score moyen ;
- meilleur et moins bon candidat ;
- spécialité la plus faible.

### 1.2 Données (base `academy`, copie locale)

| Objet | Réalité en base | Conséquence |
|---|---|---|
| Campagne de recrutement | **N'existe pas.** C'est un texte libre `users.role` porté par chaque candidat. Il y a 10 valeurs, dont « TEST CAMPAGNE PAR IBRAHIM ». | Aucune date, aucun statut, aucun poste cible, aucune BU. On ne peut ni ouvrir ni clôturer une campagne. |
| Campagne de mesure (techniciens) | **N'existe pas.** Elle se déduit des `allocations` (Factuel / Déclaratif) et du `calendar`. | Impossible de comparer 2025 et 2026 proprement. |
| BU (département) | `users.department` vaut : `Motors` (69), `Equipment` (132), `Equipment & Motors` (26), `""` (2). La variante `Equipment, Motors` existe aussi. | Il faut un référentiel à valeurs multiples : {Motors, Equipment}. |
| Filiale | `users.subsidiary` en texte (12 valeurs, dont `""`). | Il faut un référentiel `cfao_subsidiaries`. |
| Suppression | `users.active = false` (23 techniciens, 0 candidat). | Le soft delete existe déjà dans les faits, mais sans date, auteur ni motif. |
| Dates | Chaînes aux formats hétérogènes (`12-06-2024 07:0:th`). | Il faut normaliser avant toute agrégation par période. |
| Volumes | 252 techniciens, 184 candidats, 1 176 questions, 31 000 résultats. | — |

### 1.3 cfaoacademy (ce dépôt)

- `Portal.jsx` route `branch_hr` et `branch_admin` vers **`BranchHRDashboard.jsx`**. C'est une maquette générique (KPIs et annuaire sur `mock_lms`) sans lien avec les fonctions RH de MEDACAP.
- Compte de démonstration RH : **u5 Aminata** (`branch_hr`). Il n'y a pas de compte `group_hr`.
- **Pont MEDACAP déjà en place** : `utils/medacapConfig.js` appelle `MEDACAP2026/views/measure/api/*.php`, avec une clé partagée.
  - Le profil DPS l'utilise déjà (`dps-scope.php`, `dps-pif.php`, `dps-insights.php`), et **`portalApiDpsPifPayload` calcule déjà le PIF par filiale et département**.
- `cfao-core` (Django) : seulement `identity`, `audit` et `core`. Les modules `recruitment` et `lms` de `architecture.md` n'existent pas encore.
- Spécifications déjà écrites :
  - `PLATFORM_ROLES.md` §2.3 ;
  - `APPRENANT_VIEWS.md` §5 ;
  - `backlog.md`, epics 09 (recrutement) et 11 (administration RH) ;
  - `architecture.md` : `/candidates`, `/assessments`, `/hire`.

---

## 2. Ta proposition — avis

Sections retenues, dans l'ordre du workflow :

1. Campagne de recrutement
2. Campagne de mesure des compétences des techniciens
3. Exploitation des résultats du recrutement
4. Exploitation des résultats de la mesure des compétences
5. PIF des techniciens par filiale et par BU (Motors / Equipment)
6. Gestion des utilisateurs (candidats, techniciens), CRUD avec soft delete

**Ce qui est juste :**

- L'ordre suit le vrai cycle RH : recruter, mesurer, exploiter, former.
- Elle couvre les 8 fonctions MEDACAP du profil.
- Elle ajoute deux fonctions que MEDACAP réservait à d'autres profils : le PIF et le CRUD.
- La BU est prise comme axe d'analyse, ce que MEDACAP ne fait pas proprement.

**Ce que je propose d'ajuster :**

1. **Faire de la campagne un vrai objet.** C'est la condition des sections 1 à 4.
   - Champs :
     - type (`recrutement` | `mesure`) ;
     - filiale et BU ;
     - poste ou métier visé ;
     - marques et niveaux ;
     - dates d'ouverture et de clôture ;
     - statut (`brouillon` → `ouverte` → `clôturée`) ;
     - population.
   - Les 10 valeurs `role` de MEDACAP deviennent 10 campagnes à la reprise.
2. **Regrouper chaque campagne avec son exploitation.** Une campagne et ses résultats forment un seul parcours : préparer, suivre, exploiter. On passe ainsi à **4 entrées au lieu de 6** dans la navigation :

   | Entrée du portail | Tes sections |
   |---|---|
   | **Recrutement** | 1 + 3 |
   | **Compétences** | 2 + 4 |
   | **PIF** | 5 |
   | **Personnes** | 6 |

   Les autres profils ont 2 à 4 entrées (`data/index.js`). Six entrées dépasseraient la barre de navigation.
3. **Ajouter le passage de candidat à technicien.** Un candidat retenu devient technicien, avec son historique d'évaluation (backlog 09-6). C'est le lien entre « Recrutement » et « Personnes ». Il manque à ta liste.
4. **Faire de la BU un référentiel à valeurs multiples** : {Motors, Equipment}, jamais du texte. Un technicien peut relever des deux.
5. **Donner un contenu précis au soft delete** :
   - date, auteur et motif de suppression ;
   - restauration possible ;
   - exclusion par défaut de toutes les listes et statistiques.
   - Pour les candidats non retenus : une durée de conservation (RGPD) à définir.
6. **Distinguer RH filiale et RH groupe :**
   - `branch_hr` voit sa filiale ;
   - `group_hr` voit toutes les filiales, avec un sélecteur et une comparaison entre filiales (backlog 09-7).
7. **Ne pas perdre les fonctions MEDACAP absentes de ta liste :**
   - « Planning des tests » : il devient le calendrier d'une campagne de mesure ;
   - « Importer des candidats » : il se fait à la création d'une campagne de recrutement, comme l'import Excel du compte rendu ;
   - « État d'avancement agence » : il devient un filtre agence dans « Compétences » ;
   - les exports Excel restent dans chaque exploitation ;
   - « Planning des formations » : il est lié au PIF.

---

## 3. Le portail RH (périmètre de cette étape)

L'accueil du profil RH à la connexion, sur le modèle de `TrainerHome` : entête, puis priorités, puis espaces. On n'implémente pas les espaces eux-mêmes.

```
┌ Entête ─────────────────────────────────────────────────────────┐
│ RESSOURCES HUMAINES · Bon retour, Aminata !                      │
│ CFAO Mobility Cameroun · Motors | Equipment   [filiale ▾] (groupe)│
└──────────────────────────────────────────────────────────────────┘
 PRIORITÉS — ce qui attend une action
 [Campagne ouverte  ]  [Résultats à       ]  [PIF à valider   ]
 [Recrutement LOVOL ]  [exploiter : Mesure]  [12 techniciens   ]
 [18/25 testés ▓▓▓░ ]  [2026 clôturée     ]  [Equipment        ]

 VOS ESPACES
 [Recrutement] [Compétences] [PIF] [Personnes]
  3 campagnes   1 campagne    64 %  252 techniciens · 184 candidats
  ouvertes      en cours      couverts  3 à régulariser (BU vide)

 REPÈRES (filiale · BU)
 Techniciens évalués · Score moyen · Techniciens avec PIF · Candidats retenus
```

- **Priorités** : cartes au format `cr-session`. Seul ce qui demande une action y figure : campagne ouverte en retard, résultats à exploiter, PIF à valider, fiches incomplètes. S'il n'y a rien : « Rien en attente ».
- **Espaces** : 4 cartes chiffrées. Elles pointent vers les futures pages (`/portail/rh/recrutement`, etc.), avec une page d'attente pour l'instant.
- **Repères** : 4 indicateurs, filtrables par BU.
- **Filtre BU** : Motors / Equipment / tout. Il est présent partout, car la BU est un axe central de ta proposition.

---

## 4. Plan d'implémentation

### Étape 0 — Isolation *(faite)*

- Le réseau est servi par `cfaoacademy` (branche `feature/compte-rendu-synchronisation`, `66ed0af`), qui n'est plus touché.
- Le portail RH se développe dans un worktree séparé, `../cfaoacademy-rh` (branche `feature/portail-rh`), servi en local uniquement : `npx vite --port 5176`.
- `../cfaoacademy-stable` (`basculer.ps1`) reste disponible pour reprendre le développement dans `cfaoacademy` sans toucher les utilisateurs.

### Étape 1 — Contrat de données *(pas de backend)*

- `frontend/src/utils/rhDonnees.js` : une seule porte d'entrée (`campagnes()`, `reperes()`, `priorites()`, `personnes()`), paramétrée par filiale et BU.
- `frontend/src/data/rh/` : jeu de démonstration **dérivé de la base MEDACAP locale**, anonymisé. Il comprend les 10 campagnes de recrutement, 1 campagne de mesure 2026, et les BU normalisées.
- Le contrat est pensé pour être servi plus tard par le pont MEDACAP, puis par `cfao-core`, sans toucher aux écrans. C'est le même principe que `/cr-donnees`.

### Étape 2 — Profils et routage

- Router `branch_hr` et `group_hr` vers `RHHome`. `branch_admin` reste sur `BranchHRDashboard` : c'est l'administrateur technique, un autre besoin.
- Ajouter un compte de démonstration `group_hr`. Aminata (u5) garde `branch_hr`, sur la filiale Cameroun, BU Motors + Equipment.
- Mettre à jour les sections de navigation `branch_hr` et `group_hr` dans `data/index.js` : Recrutement, Compétences, PIF, Personnes.

### Étape 3 — Accueil RH (`pages/portal/RHHome.jsx`)

- Entête : `PortalHeader`, plus le périmètre filiale et BU, plus le sélecteur de filiale pour le profil groupe.
- Priorités, puis espaces, puis repères, en réutilisant les styles `cr-session` et `portal-kpi`.
- Pages d'attente pour les 4 espaces.
- Traductions FR / EN / PT dans `i18n/portal.js`.

### Étape 4 — Vérification

- Playwright sur les deux profils (filiale et groupe) et sur les deux écrans (125 % et 100 %).
- Filtres BU, état vide et console sans erreur.

### Plus tard (hors périmètre)

1. **Pont MEDACAP en lecture** : `rh-scope.php`, `rh-campagnes.php`, en réutilisant `bootstrap.php` et `portalApiDpsPifPayload`.
2. **Les espaces**, dans l'ordre du workflow :
   - Recrutement ;
   - Compétences ;
   - PIF ;
   - Personnes, avec le CRUD, le soft delete et le passage de candidat à technicien.
3. **`cfao-core`** : modules `recruitment` (campagnes, candidats, décision, embauche) et `competences`.
   - Reprise des données MEDACAP : normalisation des dates, des BU et des filiales, et transformation de `role` en campagnes.

---

## 5. Décisions

1. **Une seule page, sans navigation** : entête, « À traiter », puis Recrutement, Compétences, PIF, Techniciens & candidats. La barre de navigation mène aux sections de la page. Aucune carte n'ouvre d'autre page tant que les écrans métier ne sont pas construits ; seules les cartes pays sont cliquables, pour restreindre la page au pays.
2. **Composants du portail uniquement** (`PvCard`, `PortalReveal`, `PortalStaggerGrid`, `portal-section-head`, `portal-status-chip`, `portal-progress-*`, `portal-plan-filters--compact`) — aucune feuille de style propre au RH, aucune rangée d'indicateurs :
   - couleurs des barres selon `docs/PORTAL_COLORIMETRY.md` : vert `#1aab5b` ≥ 80 % (Couverte), orange `#e67e00` ≥ 50 % (En cours), rouge `var(--red)` sinon (En retard) ;
   - Recrutement : **cartes de fonctionnalité** selon le cycle — Créer une campagne ; Campagnes en cours (puce « n ouvertes », barres « Candidats testés » et « Score moyen » vide « En attente » jusqu'à la clôture, prochaine clôture) ; Campagnes terminées (puce « n clôturées », barres « Candidats testés » et « Score moyen »). 4e carte envisagée : Épreuves (bibliothèque de tests, `create_fixed_paper`) ;
   - Compétences et PIF : **cartes pays** `PvCard` avec en-tête façon héros (`cardMedia`) — drapeau sous le voile marine des héros (dégradé 0,72 → 0,12), puce de statut et nom du pays en blanc, 112 px ; une seule barre par carte. Compétences : titre « Maîtrise globale des compétences : x % », barre « Techniciens évalués ». PIF : titre « n PIF validés », barre « Techniciens avec PIF » ; le détail par BU passe par le filtre BU ;
   - Techniciens & candidats : **cartes CRUD** — Ajouter un collaborateur (fiche ou import Excel), Candidats (puce « n actifs »), Techniciens (puce « n actifs », barre « Fiches complètes »), Corbeille (suppression douce : date, auteur, motif, restauration) ;
   - périmètre : barre de filtres du plan de formation (`portal-plan-filters--compact`), appliquée à toute la page.
3. **RH Groupe d'abord** (`group_hr`, compte de démonstration u11 Clarisse MBARGA). La RH filiale reprendra `RHHome` avec `filialeFixe`.
4. Données : jeu de démonstration dérivé de MEDACAP, régénérable avec `scripts/rh/extraire-demo-medacap.js`.

## 6. État — accueil RH Groupe

- `pages/portal/RHHome.jsx` : entête, **À traiter** (une priorité au plus par espace), puis Recrutement, Compétences, PIF, Techniciens & candidats.
- Périmètre filiale × BU appliqué à toute la page ; un clic sur une carte pays (Compétences, PIF) restreint la page à ce pays.
- `utils/rhDonnees.js` : contrat de données (synthèses, répartitions, niveaux, priorités par périmètre).
- À venir : écrans métier derrière chaque carte (création de campagne, suivi, résultats, fiches, corbeille), puis la variante RH filiale.
