# Méthodologie des Rôles & Habilitations — CFAO Academy

Ce dossier documente la méthodologie, les standards industriels et les règles de conception régissant la gestion des profils, des rôles et des habilitations au sein de la plateforme **CFAO Academy**.

---

## 1. Principes Fondamentaux

La modélisation des droits de CFAO Academy s'appuie sur quatre piliers d'architecture :

### 1.1 Séparation stricte de l'Authentification (AuthN) et de l'Autorisation (AuthZ)
* **Keycloak** gère l'authentification : il identifie l'utilisateur (`sub`, email, identifiants) et émet un jeton OIDC/JWT.
* **Cerbos** gère l'autorisation : il évalue les droits en mode *default-deny* à partir des attributs métier que nous possédons (`scopeNode`, `departments`, `brands`, rôles, niveaux de certification).

### 1.2 Rôles Cumulables (*Multi-Assignment*)
Contrairement aux architectures rigides à rôle unique, un compte CFAO Academy peut cumuler plusieurs affectations actives (`RoleAssignment`). Les droits effectifs sont l'**union** des prérogatives de chaque affectation.
* *Exemple :* Un collaborateur peut être simultanément **Apprenant** (`learner`) dans son agence, **Key Instructor** (`ki`) pour la marque Toyota au niveau de sa filiale, et **Chef d'équipe** (`team_manager`).

### 1.3 Modèle de Scope à 3 Dimensions
Chaque droit d'accès et chaque filtre de données s'exprime selon trois dimensions orthogonales :
1. **Scope Organisationnel :** Arbre hiérarchique `Groupe` $\rightarrow$ `Région` $\rightarrow$ `Filiale` $\rightarrow$ `Agence`.
2. **Scope Département :** `Motors` (VL / VU) vs `Equipment` (Poids lourds, engins, chariots, bus).
3. **Scope Marque :** Marques certifiées ou assignées (Toyota, Suzuki, Hino, Sinotruk, Stellantis, Yamaha, etc.).

### 1.4 Principe de Moindre Privilège & *Default-Deny*
Par défaut, toute action est interdite. Les politiques Cerbos n'ouvrent que les accès explicitement requis par les responsabilités opérationnelles du profil.

---

## 2. Typologie des Rôles du Réseau

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GOUVERNANCE & PILOTAGE                             │
│       Super Admin (superadmin)  ·  Équipe Build (build_team / app 15)       │
│       Direction Groupe (group_director)  ·  Admin Groupe (group_admin)      │
│       RH Groupe (group_hr)  ·  Direction Régionale (regional_director)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                           PILOTAGE FILIALE & SAV                            │
│       Direction Filiale (branch_director)  ·  Admin Filiale (branch_admin)  │
│       RH Filiale (branch_hr)  ·  DOP (dop)  ·  DPS (dps)                    │
│       Chef d'Atelier (workshop_manager)  ·  Chef d'Équipe (team_manager)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                    ACADEMY & RELAIS PÉDAGOGIQUES                            │
│   Formateur Academy (trainer)  ·  Directeur Centre (center_director)        │
│   Assistante Centre (center_assistant)  ·  Éditeur Contenu (content_editor) │
│                                                                             │
│   ★ KEY INSTRUCTOR (ki)  ·  ★ PARTNER INSTRUCTOR / PIC (pic)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
│                           TERRAIN & APPRENANTS                              │
│       Apprenant / Technicien (learner)  ·  Candidat (candidate)             │
│       Partenaire B2B (b2b_partner)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Index des Dossiers Approfondis par Rôle

Chaque rôle stratégique fait l'objet d'un dossier méthodologique complet détaillant son référentiel marché, ses normes, sa matrice de droits et ses innovations UX :

| Document | Rôle | Description synthétique |
|---|---|---|
| **[KEY_INSTRUCTOR.md](./KEY_INSTRUCTOR.md)** | **Key Instructor (KI) & PIC** | Formateur suppléant d'atelier, double casquette praticien/évaluateur, standards Toyota TEAM21 / TSM, méthode TWI/OJT, Dojo d'atelier, et innovations pour le portail KI. |
| *À venir* | **Trainer (Formateur Constructeur)** | Formateur professionnel central accrédité, animation sessions Academy, ingénierie de formation. |
| *À venir* | **DPS & DOP (Directeurs SAV / Opérations)** | Pilotage analytique de la performance SAV, taux de certification, cartographie des besoins. |
| *À venir* | **Workshop Manager (Chef d'Atelier)** | Management opérationnel de proximité, planification des PIF, arbitrage des départs en formation. |

---

## 4. Références Normatives & Architecture

* **Matrice des applications :** [PLATFORM_APPS.md](../PLATFORM_APPS.md)
* **Matrice des rôles et scopes :** [PLATFORM_ROLES.md](../PLATFORM_ROLES.md)
* **Architecture globale & Cerbos :** [architecture.md](../architecture.md)
* **Modèle de compétences techniques :** [docs/medacap-competency-model.md](../medacap-competency-model.md)
