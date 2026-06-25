# CFAO Academy — Rôles, Périmètres & Structure Organisationnelle

Référence de conception pour le système d'authentification et de permissions.

---

## 1. Structure organisationnelle

```
Groupe (CFAO Group)
  └── Région                    ← optionnel (regroupe N filiales)
       └── Filiale              ← ex. CFAO Cameroun, CFAO Côte d'Ivoire
            ├── Département     ← Motors / Equipment / Toyota / Suzuki / Multi-marques…
            └── Agence          ← point de vente / atelier physique
```

### Règles départements

Chaque filiale est organisée en **départements** qui définissent le périmètre marques.
Les départements ne sont pas standardisés — ils varient selon la filiale :

| Type de département | Marques couvertes | Notes |
|---------------------|-------------------|-------|
| Mobility / Motors | Toutes marques VL de la filiale | Nom varie selon filiale |
| Toyota | Toyota uniquement | Filiales avec gros volume Toyota |
| Suzuki | Suzuki uniquement | Idem |
| Multi-marques Motors | Plusieurs marques VL | Petit marché ou multi-brand |
| Equipment | Toutes marques PL/Engins/Chariots/Bus | **Toujours Equipment — jamais Motors** |

> **Règle absolue :** PL, engins, chariots et bus = département Equipment, sans exception.
> VL = département Mobility/Motors ou département par marque selon la filiale.

---

## 2. Rôles

> **Rôles cumulables.** Sauf exception documentée (§5), les rôles ne s'excluent pas : un même compte peut porter **plusieurs affectations** (`role_assignment`), chacune avec son rôle, son scope org, ses départements et ses marques. Les droits effectifs = **union** des permissions de toutes les affectations actives (modèle Cerbos : `principal.roles[]`).

### 2.1 Rôles terrain / opérationnels

| Rôle | Code | Description |
|------|------|-------------|
| **Apprenant** | `learner` | Technicien, commercial, carrossier, Parts, Process SAV en formation. Scope = agence + marques assignées. |
| **KI** (Key Instructor) | `ki` | Technicien certifié **minimum niveau 2** (ex. G3, Step 2) de la filiale, habilité à former les niveaux inférieurs dans sa marque. Agit comme **formateur suppléant** sur le terrain — technicien d'abord, pas formateur constructeur Academy. Scope org = **filiale** + marque certifiée. |
| **PIC** (Partner Instructor Manager) | `pic` | Même profil que KI (formateur suppléant, niveau 2+), mais rattaché à un réseau partenaire ou une filiale externe. Scope org = **filiale** du partenaire + marque certifiée. |
| **Manager Chef d'équipe** | `team_manager` | Responsable d'une équipe dans un département. Scope = agence + marques du département. |
| **Manager Chef d'atelier** | `workshop_manager` | Responsable de l'atelier. Supervise les techniciens, KI et chefs d'équipe. Scope = agence + marques du département. |
| **DPS** (Directeur Pièces & Services) | `dps` | Pilote le département pièces et le SAV. Scope = agence ou filiale, toutes marques du département. |
| **DOP** (Directeur des Opérations) | `dop` | Direction opérationnelle. Scope = filiale, toutes marques. |
| **Directeur Filiale** | `branch_director` | Dirige la filiale. Scope = filiale complète, tous départements, toutes marques. |
| **Directeur Régional** | `regional_director` | Pilote plusieurs filiales dans une région. Scope = région (N filiales). |
| **Directeur Groupe** | `group_director` | Direction centrale. Scope = groupe entier. |

### 2.2 Rôles formation / Academy

| Rôle | Code | Description |
|------|------|-------------|
| **Formateur** | `trainer` | Formateur **certifié constructeur** — accrédité par la marque (ex. Toyota Master Trainer). Intervient en présentiel ou distanciel au centre Academy. Différent du KI/PIC : expert Academy ou externe, pas technicien terrain ; scope flottant multi-filiales selon les sessions. Le KI/PIC est le **formateur suppléant** interne. |
| **Assistante du centre** | `center_assistant` | Support administratif et logistique du centre de formation Academy. Gère les inscriptions, planning salles, convocations. |
| **Directeur du centre de formation** | `center_director` | Dirige le centre de formation CFAO Academy. Supervise formateurs, assistante, planning pédagogique. |
| **Éditeur de contenu** | `content_editor` | Rédige, édite et publie les articles du site vitrine via Wagtail (actualités, événements, certifications, nouveautés). Workflow brouillon → relecture → publication. Scope = groupe (contenu global). Réservé à l'équipe Academy et aux référents communication filiale désignés. Cumul courant : `content_editor` + `learner` ou `center_assistant`. |

### 2.3 Rôles RH & Admin

| Rôle | Code | Description |
|------|------|-------------|
| **Admin Filiale** | `branch_admin` | Administrateur technique de la filiale dans la plateforme. Gère les comptes, droits, départements. Scope = filiale. |
| **RH Filiale** | `branch_hr` | Ressources humaines de la filiale. Accès aux dossiers collaborateurs, formations suivies, certifications. Scope = filiale. |
| **Admin Groupe** | `group_admin` | Administrateur technique du groupe. Gère toutes les filiales, les structures orga. Scope = groupe. |
| **RH Groupe** | `group_hr` | RH centrale. Accès aux données formation/certification de tous les collaborateurs du groupe. Scope = groupe. |
| **Super Admin** | `superadmin` | Accès total sans restriction. Réservé équipe technique CFAO Academy. |
| **Équipe build** | `build_team` | Compte technique projet plateforme. App **15** : backlog delivery, statut tests, preview digest Git. Pas d'accès admin org (app 12) ni données formation terrain. Scope = groupe / projet. |

### 2.4 Rôles externes / candidats

| Rôle | Code | Description |
|------|------|-------------|
| **Candidat** | `candidate` | Personne en cours de recrutement pour un poste dans le réseau CFAO. Peut être évalué sur ses compétences techniques, **parfois par marque** (ex. candidat technicien Toyota). Accès limité à son espace candidature et aux évaluations assignées. |
| **Partenaire B2B** | `b2b_partner` | Technicien ou gestionnaire d'une entreprise cliente externe (flotte, carrosserie partenaire…). Accès aux formations ouvertes aux partenaires. Scope = son entreprise + marques assignées. |

---

## 3. Dimensions de scope

Chaque utilisateur a un scope défini selon **3 dimensions** :

### 3.1 Scope organisationnel

```
agence < filiale < région < groupe
```

Un utilisateur **voit et agit** sur tout ce qui est à son niveau et en dessous.
- Un Directeur Filiale voit toutes les agences de sa filiale
- Un Directeur Régional voit toutes les filiales de sa région
- Un Admin Groupe voit tout

Certains rôles ont un scope org particulier :
- **KI / PIC** : scope = **filiale** (toutes les agences de la filiale pour la marque certifiée) — pas de scope flottant inter-filiales
- **Formateur** : scope flottant — intervient sur plusieurs agences et filiales selon affectation session

### 3.2 Scope département

Chaque utilisateur est rattaché à un ou plusieurs **départements** dans son agence/filiale :
- `motors` — VL (Mobility, Toyota, Suzuki, Multi-marques VL)
- `equipment` — PL, Engins, Chariots, Bus

À partir de **DPS / DOP / Directeur**, le scope département est généralement "tous départements" de leur périmètre org.

### 3.3 Scope marque

À l'intérieur d'un département, un utilisateur peut être restreint à certaines marques :

| Exemple | Scope marque |
|---------|-------------|
| Technicien Toyota G3 | `toyota` uniquement |
| Chef d'atelier Motors polyvalent | `toyota`, `mercedes`, `suzuki` |
| KI Sinotruk (filiale Cameroun) | `sinotruk` uniquement — scope org = filiale `br_cmr` |
| DPS | Toutes marques de son département |
| Directeur Filiale | Toutes marques |
| Candidat pour poste Toyota | Évaluation scope `toyota` |

---

## 4. Cas particuliers

### KI et PIC — formateur suppléant, double casquette apprenant / formateur

Le KI et le PIC sont des **techniciens** ayant atteint un niveau de certification minimum (≥ niveau 2, ex. G3, Step 2) et habilités à **former les niveaux inférieurs** dans leur marque. On peut les appeler **formateur suppléant** : ils dispensent la formation sur le terrain, en complément ou en relais des formateurs constructeur du centre Academy.

**Ce qu'ils ne sont pas :** formateurs certifiés constructeur (`trainer`) — pas d'accréditation Academy, pas de scope flottant inter-filiales.

#### Scope

| Dimension | KI / PIC |
|-----------|----------|
| **Organisation** | **Filiale** — toutes les agences de la filiale pour les actions pédagogiques et le suivi de leurs apprenants |
| **Département** | Celui de leur rattachement (ex. `motors`, `equipment`) |
| **Marque** | **Une marque certifiée** — un KI Toyota ne forme et ne suit que des apprenants Toyota |

#### Casquette apprenant (obligatoire)

Le KI/PIC reste un **technicien** : il conserve le rôle `learner` et est soumis aux mêmes règles qu'un apprenant classique :

- **Mesure de compétences** — évaluations périodiques ou à la demande, comme tout technicien du réseau
- **Plan de formation personnel** — parcours de montée en compétence et certifications propres (ex. viser G2 alors qu'il est G3)
- **Espace apprenant (app 02)** — consultation de ses modules, attestations, progression

Le rôle pédagogique (`ki` / `pic`) est un **attribut additionnel** sur le compte, pas un remplacement du profil apprenant.

#### Formations à dispenser (casquette formateur suppléant)

Habilitations limitées à ce que sa certification autorise — **niveaux strictement inférieurs** au sien, **dans sa marque**, **dans sa filiale** :

| Élément | Règle |
|---------|-------|
| **Périmètre marque** | Uniquement la marque pour laquelle il est certifié KI/PIC |
| **Niveaux dispensables** | Niveaux inférieurs au sien (ex. KI G3 → forme G4, Step 1 ; ne dispense pas G2 ni G1) |
| **Périmètre org** | Agences de sa filiale — pas d'intervention hors filiale |
| **Apprenants suivis** | Techniciens de niveau inférieur qui lui sont assignés (app 03) |
| **Évaluations terrain** | Saisie et validation des compétences de ses apprenants (app 03) |
| **Sessions internes** | Peut animer des sessions internes KI/PIC et réserver des salles pour celles-ci (apps 04–05) |

Les **formations à dispenser** sont dérivées du catalogue marque + niveau de certification du KI/PIC : la plateforme expose la liste des modules qu'il est habilité à transmettre (et seulement ceux-là).

#### Distinction KI vs PIC

| | KI | PIC |
|---|-----|-----|
| **Rattachement** | Réseau CFAO (filiale interne) | Réseau partenaire ou filiale externe |
| **Profil métier** | Identique — formateur suppléant, technicien apprenant | Identique |
| **Scope** | Filiale CFAO + marque certifiée | Filiale partenaire + marque certifiée |

### Candidats — évaluation par marque
- Un candidat peut passer des **évaluations techniques ciblées par marque** (ex. test Toyota G4 pour un recrutement technicien VL).
- Son compte n'est pas lié à une agence tant qu'il n'est pas recruté.
- À l'embauche, le compte candidat bascule vers le rôle terrain approprié.

### Formateurs — scope flottant
- Un formateur certifié peut intervenir dans **plusieurs filiales** selon les besoins.
- Son scope org est défini session par session, pas fixe.
- Il est rattaché au centre Academy pour son administration.

---

## 5. Rôles cumulables

### Principe

Chaque affectation est une ligne indépendante : rôle + `scopeNode` + département(s) + marque(s). L'accès à une app ou une action est accordé si **au moins une** affectation du compte le permet, dans le périmètre de **cette** affectation.

```
Compte utilisateur
  ├── role_assignment #1  →  learner      · agence Douala · motors · toyota
  ├── role_assignment #2  →  ki           · filiale CM    · motors · toyota   ← formateur suppléant
  └── role_assignment #3  →  team_manager · agence Douala · motors · toyota
```

**Pourquoi cumuler plutôt qu'un « super-rôle » ?** Chaque droit reste traçable à une affectation (« pourquoi Marie voit l'app 03 ? → `ki` filiale CM Toyota »). L'audit et l'admin RH (app 11) restent lisibles.

### Cumuls courants (terrain)

| Combinaison | Profil type | Apps principales |
|-------------|-------------|------------------|
| `learner` + `ki` ou `pic` | Technicien certifié, **formateur suppléant** sur sa marque | 02 (parcours perso) + 03 (ses apprenants) + 05–06 (sessions internes) |
| `learner` + `team_manager` | Chef d'équipe encore en montée en compétence | 02 + 07 (son équipe) + 08 W (propositions inscription) |
| `learner` + `workshop_manager` | Chef d'atelier technicien | 02 + 03 R (KI/PIC de l'atelier) + 07 + 08 |
| `learner` + `workshop_manager` + `ki` | Chef d'atelier qui est aussi KI | Union des trois lignes ci-dessus |
| `learner` + `dps` / `dop` | Directeur département avec plan de formation perso | 02 + 07 + 10 |
| `learner` + `branch_director` | Directeur filiale avec parcours certification perso | 02 R + 07 + 10 |
| `branch_admin` + `branch_hr` | Même personne admin technique et RH filiale | 11 (comptes + champs RH) |
| `trainer` + `learner` | Formateur constructeur qui suit aussi des modules | 02 + 04 (sessions Academy) |
| `center_assistant` + `learner` | Assistante centre en formation continue | 02 + 04–08 selon périmètre Academy |
| `ki` × N marques | KI habilité sur **deux marques** (rare, double certification) | Deux affectations `ki` distinctes — une par marque, même filiale |

### Cumuls courants (Academy & management)

| Combinaison | Note |
|-------------|------|
| `trainer` + `center_assistant` | Rare — plutôt deux personnes ; possible sur petits centres |
| `center_director` + `trainer` | Directeur centre encore formateur actif |
| `branch_admin` + `learner` | Admin filiale collaborateur du réseau |
| Hiérarchie + lecture descendante | `branch_director` n'embarque pas automatiquement `team_manager` : si besoin opérationnel, affectation explicite |

### Règles de cumul

| Règle | Détail |
|-------|--------|
| **Union des droits** | Si une affectation autorise l'action dans le scope de la ressource → ALLOW |
| **Scope par affectation** | Chaque ligne a son propre `scopeNode` / départements / marques ; pas de « scope maximal » implicite |
| **`learner` quasi-systématique** | Tout collaborateur terrain en formation conserve `learner` — y compris KI/PIC, managers, directeurs |
| **KI/PIC ⊂ technicien** | `ki` ou `pic` s'ajoute toujours à `learner`, jamais en remplacement |
| **Formateur suppléant ≠ `trainer`** | `ki`/`pic` et `trainer` sont des rôles distincts ; cumul possible mais peu fréquent (ex. technicien devenu formateur Academy) |
| **Multi-marque KI** | Une affectation `ki` = **une marque** ; deux marques = deux affectations |
| **Multi-filiale formateur** | `trainer` : scope session par session ; plusieurs `scopeNodes` possibles sur le principal (cf. `architecture_complement.md`) |

### Incompatibilités et exclusivités

| Situation | Règle |
|---------|-------|
| **`candidate`** | Exclusif tant que le recrutement n'est pas clos — à l'embauche, bascule vers `learner` (+ rôles terrain assignés) |
| **`ki` vs `pic`** | Mutuellement exclusifs sur un même compte — réseau interne CFAO **ou** réseau partenaire |
| **`superadmin`** | Réservé équipe technique ; ne pas cumuler avec des rôles métier terrain (audit et séparation des pouvoirs) |
| **`build_team`** *(optionnel)* | Compte technique équipe delivery — app **15** RW (backlog, tests, preview digest) sans droits app 12 complets |
| **Même rôle, deux scopes** | Autorisé si périmètres différents (ex. `ki` Toyota filiale A + `ki` Toyota filiale B — formateur flottant KI, cas exceptionnel documenté) |

### Impact UI portail

Un compte cumulatif voit dans le portail **toutes les apps** auxquelles au moins une affectation donne accès (ex. KI → apps 02 + 03 + 05 + 06 + 07 mini-dashboard). Pas de « mode rôle » obligatoire au démarrage : navigation par apps ; le filtrage des données est assuré côté API (Cerbos + scope de l'affectation concernée).

---

## 6. Matrice des permissions (à affiner)

| Rôle | Voir ses formations | Voir formations filiale | Gérer comptes | Gérer orga | Tout |
|------|---------------------|------------------------|---------------|------------|------|
| Candidat | ✓ (évaluations) | — | — | — | — |
| Apprenant | ✓ | — | — | — | — |
| KI / PIC | ✓ (parcours perso + mesure compétences) + voir ses apprenants + formations à dispenser | — (filiale via managers) | — | — | — |
| Manager | ✓ + voir son équipe | — | — | — | — |
| DPS / DOP | ✓ | ✓ (dept) | — | — | — |
| Dir. Filiale | ✓ | ✓ | — | — | — |
| Admin Filiale | ✓ | ✓ | ✓ (filiale) | — | — |
| RH Filiale | ✓ | ✓ | lecture | — | — |
| Dir. Régional | ✓ | ✓ (région) | — | — | — |
| Dir. Groupe | ✓ | ✓ (groupe) | — | — | — |
| Admin Groupe | ✓ | ✓ | ✓ (groupe) | ✓ | — |
| RH Groupe | ✓ | ✓ | lecture | — | — |
| Formateur | ✓ | ✓ (sessions) | — | — | — |
| Dir. Centre | ✓ | ✓ | ✓ (formateurs) | — | — |
| Assistante | ✓ | ✓ (planning) | lecture | — | — |
| Super Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Partenaire B2B | ✓ | — | — | — | — |
| Éditeur contenu | — | — | — | — | — |
| Équipe build (`build_team`) | — | — | — | — | ✓ (app 15) |

> `content_editor` n'apparaît pas dans cette matrice car ses permissions concernent le CMS Wagtail (app 13), non les données de formation. Dans Wagtail : RW articles + médias dans le workflow éditorial.

> **App 15 — reporting MOA.** Mail **vendredi** (formel, non technique) ; **rappel jeudi** aux devs. Conventions de rédaction commits : **`CONTRIBUTING.md`**. Destinataires MOA configurables (emails externes). Accès in-app : Super Admin, Admin Groupe (R), Dir. Groupe (R), `build_team`.
