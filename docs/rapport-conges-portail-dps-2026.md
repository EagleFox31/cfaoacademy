# Rapport de passation — CFAO Academy & portail DPS

Document rédigé **avant congés** (juillet 2026) pour situer le travail réalisé sur ce projet, **pourquoi**, ce qui est **visible** en démo locale, et le lien **CFAO Academy ↔ MEDACAP**.

---

## Synthèse exécutive

**CFAO Academy** est la plateforme de formation CFAO Mobility : site vitrine public + portail connecté par persona (apprenant, RH, DPS filiale, etc.).

**MEDACAP** est l’outil compétence & formation (PHP + MongoDB) déjà en production chez CFAO. Le portail DPS **ne remplace pas** MEDACAP : il **agrège et présente** ses données (scores, PIF) dans l’UI Academy, avec une réplique React partielle du dashboard Define pour le PIF technicien.

**Travail principal de la session** : refonte UX du **portail DPS filiale** (compétences par marque, plans de formation, intégration MEDACAP, polish vitrine connectée).

---

## 1. Contexte — CFAO Academy (ce dépôt)

### Architecture

| Couche | Dossier | Rôle |
|--------|---------|------|
| **Front** | `frontend/` | React 19 + Vite — vitrine (`/`, formations, actualités…) + portail (`/portail`) |
| **Backend** | `cfao-core/` | Django/DRF — identité, LMS (catalogue, inscriptions), analytics |
| **Ops** | `cfao-operations/` | Node — sessions, salles, planning |
| **AuthZ** | `cerbos/` | Policies Cerbos (default-deny, scopes org/marque) |
| **Contenu** | `catalogues/`, `data/` | Fiches PNG/PDF, sessions 2026, articles |
| **Pont MEDACAP** | `scripts/medacap-api/` | PHP local → Mongo + SSO Define (`portal-launch-define.php`) |

### Démo locale

```bash
cd frontend && npm ci && npm run dev   # http://localhost:5173
```

- **Auth démo** : `sessionStorage` (`cfao_mock_user`), profils dans `frontend/src/data/mock_profiles.json`
- **Profil DPS filiale** : se connecter via `/login` (ex. utilisateur mock **u10**)
- **Données DPS** : mocks `LMS_BY_USER` + API MEDACAP si WAMP/Mongo tournent

### Site vitrine (hors portail)

Routes principales : `/`, `/formations`, `/publics`, `/actualites/:slug`, `/login`.

Ordre sections accueil : Hero → Actualités → Publics → Offres → Sessions → Academy → Témoignages → CTA.

Règles métier vitrine documentées dans `.cursor/rules/cfaoacademy-project.mdc` (formateurs catalogue, codes fiches PNG, hero, carrousels…).

---

## 2. Contexte — MEDACAP

### Qu’est-ce que c’est ?

Outil interne CFAO pour :

1. **Mesurer** les compétences techniciens (QCM théorie + pratique)
2. **Planifier** les formations (module **Define** — PIF pluriannuel)
3. **Gérer** les utilisateurs, marques, agences, filiales

**Base** : MongoDB `academy` (~489 users Cameroun Equipment en juin 2026).

### Vocabulaire portail ↔ Mongo

| UI portail | Mongo | Couleur norme UI |
|------------|-------|------------------|
| Maintenance | `brandJunior` / tests `Junior` | Bleu `#1a56db` |
| Réparation | `brandSenior` / tests `Senior` | Orange `#e67e00` |
| Diagnostic | `brandExpert` / tests `Expert` | Vert `#1aab5b` |

| Type test | Mongo | Portail |
|-----------|-------|---------|
| Théorie | `Factuel` | `modality: theory` |
| Pratique | `Declaratif` | `modality: practical` |

### Champs technicien importants

```text
users {
  level: "Junior" | "Senior" | "Expert",     // palier global
  brandJunior:  ["JCB", "LOVOL", ...],      // marques maintenance
  brandSenior:  [...],                      // marques réparation
  brandExpert:  [...],                      // marques diagnostic
}
```

**Règle cumulative** : un Expert passe (et voit) les batteries Junior + Senior + Expert.

### Pages MEDACAP utiles au portail

| Page PHP | Usage |
|----------|-------|
| `views/measure/api/dps-insights.php` | Agrégats compétences filiale (hero DPS, cartes marques) |
| `views/define/collaboratorDashboard.php` | Dashboard PIF par collaborateur |
| `views/measure/api/portal-launch-define.php` | SSO depuis le portail CFAO → Define |
| `views/define/dashboard.php` | Fallback démo sans SSO |

Mode **embed** (`?embed=1`) : sans header/footer MEDACAP, filtres natifs masqués si gérés côté Academy.

### Docs repo MEDACAP

| Fichier | Contenu |
|---------|---------|
| `docs/medacap-competency-model.md` | Modèle GF, tests, boucles API |
| `docs/medacap-mongo-collections.md` | Inventaire collections Mongo |
| `docs/dps-competency-tier-visual.md` | Norme couleurs paliers (ne pas recoder ailleurs) |
| `docs/portail-dps-fiabilite.md` | Fraîcheur données, skeleton, notifications |
| `docs/portal-dps-insights-cache.md` | Cache insights filiale |

---

## 3. Pourquoi ce travail (objectifs métier)

1. **Vue DPS filiale unifiée** — compétences + PIF dans le portail CFAO, même look & feel que le reste d’Academy.
2. **Lecture fiable des scores** — tableaux par palier, totaux alignés hero, comptages techniciens cohérents.
3. **PIF technicien** — voir le plan de formation d’un collaborateur sans quitter l’écosystème visuel Academy (réplique React + lien MEDACAP complet si besoin).
4. **Transparence données** — horodatage, méthode, skeleton, alertes (déjà livré, doc `portail-dps-fiabilite.md`).
5. **Vitrine connectée** — accueil logged-in aligné sur le fond portail (pas le mode invité Netflix).
6. **Socle backend** (parallèle) — module LMS Django, policies Cerbos course/enrollment/system_role.

---

## 4. Travail réalisé — chronologie & thèmes

### Phase A — Portail DPS « Maîtrise des compétences » (par marque)

**Problème** : cartes technicien illisibles, libellés flous, mauvais alignement visuel.

**Évolution** :

1. Cartes → **3 tableaux** (Maintenance / Réparation / Diagnostic).
2. Colonnes : Nom, Prénom, Poste, Score total (théorie + pratique).
3. **Format fiche article** : `article-sheet`, croix fermeture, logos CFAO + marque, fond portail conservé.
4. **Tableaux solides** : lignes blanches, encadrement pastel par palier (bleu / violet / jaune diagnostic), thead + footer en **fond foncé** du palier.
5. **Hero détail** réduit ; logo marque centré et agrandi ; titre sans répéter la marque.
6. **Animation** morph ouverture/fermeture depuis la carte marque (`useBrandDetailEntrance`).
7. **Comptages** : « XX techniciens Maintenance… », ligne totale filiale dans le hero marques.
8. **Composants réutilisables** : `DpsBrandTierTechniciansTable`, `DpsBrandTierTechniciansSection`, logique centralisée dans `dpsMetrics.js`.

**Règle métier finale (compétences par marque)** :

- Un technicien apparaît **dans un seul tableau**, celui de son **`users.level`** (Junior → Maintenance, Senior → Réparation, Expert → Diagnostic).
- La **note affichée** = scores à **ce palier** sur **la marque consultée**.
- Le **poste** affiché suit aussi le `users.level` global (Maintenancier / Réparateur / Diagnostiqueur).
- Distinction importante : pour le **comptage marque** (hero, cartes marques), on utilise les listes `brandJunior/Senior/Expert` ; pour la **fiche détail tableau**, on utilise `users.level`. Cas limite traité : ex. Yaya Soulemanou Senior avec LOVOL uniquement en `brandJunior` → compté LOVOL en junior pour les totaux marque, absent du tableau Expert.

**Fichiers clés** :  
`DpsBrandCompetencyDetail.jsx`, `DpsBrandCompetencyDetailView.jsx`, `DpsBrandTierTechniciansTable.jsx`, `dpsMetrics.js`, `dpsTechnicianRoleTheme.js`, `dpsCompetencyTierTheme.js`, `portal.css`.

---

### Phase B — Portail DPS « Plans de formation pluriannuels » (PIF)

**Problème** : ouvrir MEDACAP brut = chrome externe, pas de continuité UX, pas de deep-link par technicien.

**Évolution** :

1. Section renommée → **« Plans de formations pluriannuels de vos techniciens »**.
2. Cartes technicien par palier (`users.level`) avec marques, agence, nb formations PIF.
3. **Clic carte** → page React **`/portail/technicien/:technicianId/pif`** (même pattern que détail marque), **pas** MEDACAP direct.
4. **Réplique React** du dashboard Define technicien dans `frontend/src/medacap/define/technician/` :
   - Filtres marque / niveau / période (pluri, 2026, 2025, 2024)
   - Barre contexte technicien, carrousel marques, KPI, graphique mesure
   - Données résolues via `resolveTechnicianDefinePlan.js` depuis le scope LMS
5. Bouton optionnel **« Ouvrir dans MEDACAP »** → `launchMedacapExternal` → page pont `/portail/medacap-launch?to=…` → loader CFAO → redirect MEDACAP (`collaboratorDashboard.php?embed=1`).
6. **Embed PHP** MEDACAP : header/footer masqués, carte filtres MEDACAP masquée (filtres gérés côté Academy quand embed).
7. **Intégrateur SSO** : `portal-launch-define.php` + `medacapDefine.js` — le DPS reste connecté, voit le dashboard **du technicien ciblé** via `technicianId` dans l’URL.

**Corrections loader MEDACAP** :

- Loader **plus en overlay** sur le dashboard portail.
- Bug **2ᵉ onglet login** corrigé : `sessionStorage` isolé par onglet → auth retirée de `MedacapLaunch.jsx`.
- Ouverture MEDACAP en **même onglet** (plus de `window.open`) sur demande utilisateur.

**Fichiers clés** :  
`DpsFilialePifSection.jsx`, `DpsTechnicianPifDetail.jsx`, `DpsTechnicianPifDetailView.jsx`, `dpsTechnicianPifNavigation.js`, `dpsFilialePifTechnicians.js`, `medacap/define/technician/*`, `launchMedacapExternal.js`, `MedacapLaunch.jsx`, `medacapDefine.js`, `scripts/medacap-api/collaboratorDashboard.php`.

---

### Phase C — Vitrine accueil & actualités

| Sujet | Changement |
|-------|------------|
| Hero titres dynamiques | Mot-clé en rouge italique après « compétences en » |
| Carrousel hero | Intervalle 10 s |
| Section Actualités | Remontée visuelle sous le hero |
| Accueil **connecté** | Fond portail (photo fixe + overlays zebra clair/sombre), hero transparent, typo sombre sur sections claires |
| Hero 15″ (~1080p) | Hauteur réduite (`--hero-visual-h`) |
| Articles vidéo | Auto-scroll vers vidéo, bouton fermer top-right, sizing viewport |

**Fichiers** : `Accueil.jsx`, `HomeHero.jsx`, `index.css`, `Article.jsx`, `ArticleHeroVideo.jsx`, `useArticleHeroScroll.js`.

---

### Phase D — Fiabilité DPS (livré avant, documenté)

Voir `docs/portail-dps-fiabilite.md` :

- « Mis à jour il y a X min »
- Popover « Méthode » par section
- Skeleton chargement périmètre MEDACAP
- Cloche notifications + journal `#activite`

---

### Phase E — Backend CFAO Academy (socle sécurisé + LMS)

> Contrairement au front DPS (mocks + pont MEDACAP), cette partie a été **construite ET testée en conditions réelles** (stack Docker : Keycloak, Cerbos, 2× Postgres, gateway). Détail exhaustif + diagrammes : **`docs/backend-architecture.md`**. Journal de tests : **`walkthrough/`**.

#### E.1 — Ce qui tourne (fait + validé live)

| Bloc | Contenu | Statut |
|------|---------|--------|
| **Socle (nœud A)** | `docker-compose` (Keycloak, Cerbos, 2 Postgres, gateway BFF) · CI · couche **`core/`** sécurisée · endpoint `/me` de référence · **realm Keycloak config-as-code** | ✅ live |
| **Usine à modules** | `scripts/new_module.py` : génère un module **sécurisé par défaut** (ScopedModel, PEP Cerbos, tests négatifs) | ✅ |
| **Identity** | arbre org · comptes · `role_assignment` (cumulables) · `/org/units` · `/users` · affectations (POST/DELETE + recompute auto par signal) · **multi-scope** · **`/me` v2** (périmètre résolu en base) | ✅ live |
| **Gouvernance** | **audit** (journal append-only scopé) · **catalogue des rôles système** | ✅ live |
| **LMS** | **catalogue** `Course`/`Module` (aligné MEDACAP marque/GF/palier) · **inscription + progression** scopées (self + équipe) | 🟡 en cours |

Qualité : **pytest 59 · Cerbos 62 (compile + tests) · validations live**. Invariants sécurité : **default-deny**, **fail-closed**, **tests négatifs** systématiques (hors-scope, IDOR, élévation de privilège, règle Equipment).

#### E.2 — Sous-applications (modules) et leurs rôles

| Module | Service | Rôle | Rôles-métier | Statut |
|--------|---------|------|--------------|--------|
| `core` | Django | Couche transverse (authN, PEP Cerbos, query plan) | — (tous) | ✅ |
| `identity` | Django | Org, comptes, affectations rôle+périmètre | admins, RH, superadmin | ✅ |
| `audit` | Django | Traçabilité des actions sensibles | admins, superadmin | ✅ |
| `lms` | Django | Formation (catalogue, inscription ; à venir : parcours, QCM, certif, IA) | learner, ki/pic, trainer, content_editor | 🟡 |
| `recruitment` / `analytics` / `notifications` / `delivery` | Django | Recrutement · KPI · emails · cockpit MOA | RH · managers/DPS · tous · build/MOA | ⏳ |
| `sessions`/`rooms`/`planning`/`tickets` | Node (operations) | Logistique centre de formation | assistante/directeur centre, formateur, KI | ⏳ |
| — MEDACAP — | externe (PHP/Mongo) | **Mesure des compétences** (existant) | source | intègre via **contrat** |

#### E.3 — Données & sécurité partagées

- **Données** : **une base par service** (`core-db`, `ops-db`, `keycloak-db`) — jamais partagée ; périmètre commun **`org_path` / `scopeNodes`** (source de vérité = `identity`) ; inter-services par **webhooks signés HMAC + contrats** (pas d'accès DB croisé) ; **MEDACAP consommé par API** (couche anti-corruption) ; binaires en **stockage objet** (`content_ref`), pas en base.
- **Sécurité** : **Keycloak** = authN unique (JWT/JWS **vérifié via JWKS** par les 2 services ; **BFF** → cookie httpOnly, la SPA ne voit pas le JWT) ; **Cerbos = PDP partagé** core+ops (mêmes policies + rôles dérivés `common_scope` **multi-scope** : `within_org_scope`, `admin_within_scope`, `team_within_scope`) ; **PEP default-deny** sur chaque endpoint, **fail-closed** ; **listes filtrées par query plan** ; **audit** ; **secrets hors dépôt** (.env dev / Key Vault prod) + secret scanning CI.

#### E.4 — Les outils (quoi · pourquoi · comment → détail dans `docs/backend-architecture.md §2`)

| Outil | Pourquoi | Comment ici |
|-------|----------|-------------|
| **Keycloak** | ne jamais coder l'auth soi-même ; OIDC ; jetable (Okta) | realm config-as-code, JWT, clients BFF + SPA |
| **Cerbos** | séparer authN/authZ ; policies versionnées & testées, partagées | PDP partagé, `check`/`plan`, default-deny |
| **Django/DRF** | maturité, ORM, sécurité par défaut ; monolithe modulaire | 1 module = 1 app + couche `core/` |
| **Node/TS** (`jose`) | logistique temps réel, découplée | Express + JWKS + même client Cerbos |
| **PostgreSQL** | robuste ; JSON pour le scope ; 1 base/service | filtrage périmètre via `@>` |
| **gateway nginx + oauth2-proxy** | SPA sans JWT (anti-XSS) ; TLS/CORS/rate-limit | cookie httpOnly, réinjecte le Bearer |
| **Docker Compose** | env reproductible ; pas de K8s au départ | services bornés (CPU/mém) + healthchecks |
| **keycloak-config-cli** | realm reproductible sans clic | applique `keycloak/config/*.yaml` |
| **pytest / cerbos compile / vitest** | pyramide TU→TI→contrat→E2E | + secret scanning en CI (GitHub Actions) |

---

## 5. Ce qui est visible aujourd’hui (checklist démo)

### Prérequis

```bash
cd frontend && npm run dev
# Optionnel : WAMP MEDACAP + Mongo pour données live
# http://localhost/MEDACAP/...
```

### Site public

| Route | Visible |
|-------|---------|
| `/` | Hero parcours, actualités, sessions, offres marques |
| `/actualites/:slug` | Fiche article ; vidéo hero si présente |
| `/formations`, `/publics` | Catalogues |
| `/login` | Choix profil démo |

### Portail DPS (`/portail` — profil DPS filiale)

| Zone | Parcours |
|------|----------|
| Entrée `/portail` sans `#` | Loader ~850 ms puis dashboard |
| `#resultats` | Cartes marques compétences |
| `/portail/competences/:brandId` | Fiche article + 3 tableaux paliers + totaux |
| `#pif` | Cartes technicien par palier |
| `/portail/technicien/:id/pif` | **Réplique React** dashboard Define technicien |
| Bouton « Ouvrir MEDACAP » (détail PIF) | Pont loader → embed MEDACAP (même onglet) |
| Cloche | Alertes DPS |

### Accueil connecté

Même fond wallpaper que le portail, sections en bandes claires/sombres alternées.

---

## 6. Règles métier à ne pas inverser (RETEX)

1. **Couleurs paliers** : `dpsCompetencyTierTheme.js` + `DpsCompetencyTierChip` — ne pas recoder les hex ailleurs.
2. **Fiche marque (tableaux)** : placement et poste via **`users.level`**, note au palier sur la marque.
3. **Comptages hero / cartes marques** : via **`brandJunior/Senior/Expert`** (présence sur la marque).
4. **Formateurs cartes catalogue** : `catalogFormateur.js`, pas le planning `SESSIONS`.
5. **Fiches formation** : `/formations/fiche/:code` sans `?date=` = catalogue ; avec `?date=` = session.
6. **CSS sections** : ne pas imbriquer `<section>` dans `<section>` (voile blanc parasite).
7. **Hero `background-position`** : Y bas = image descend ; Y haut = coupe les têtes.
8. **Loader portail** : intro seulement sur `/portail` sans hash.
9. **Auth démo** : `sessionStorage` isolé par onglet — pas de gate login sur pages pont cross-tab.
10. **Scores tests UI** : `evalScoreTier` (RAG) ≠ couleurs paliers compétence MEDACAP.

---

## 7. Points en suspens / à reprendre après congés

| Sujet | Statut |
|-------|--------|
| Réplique React Define | Partielle (KPI + graphique + filtres) — pas 100 % parité MEDACAP |
| Données PIF réplique | Basées sur scope LMS mock / cache insights — valider vs Mongo live |
| Ouverture MEDACAP full | Même onglet + loader pont — valider avec utilisateurs |
| Mongo local | Souvent arrêté → fallback mocks |
| Export PDF filiale, NPS, polling | Roadmap `portail-dps-fiabilite.md` |
| Backend LMS + Cerbos | Intégration front au-delà des mocks |
| Wagtail site public | Architecture prévue ; front actuel = React Vite |
| Commits / PR | Travail majoritairement **non commité** — à valider MOA avant merge |

---

## 8. Note données

Recherche nominative ponctuelle dans les exports (juillet 2026) : détails retirés de ce document (données personnelles).

---

## 9. Parcours test recommandé (5 min)

1. `/login` → profil DPS filiale (u10)
2. `/portail` → attendre loader intro
3. Scroller **Maîtrise des compétences** → clic marque (ex. JCB) → vérifier tableaux + totaux
4. Scroller **Plans pluriannuels** → clic technicien → vérifier page React + filtres
5. (Optionnel) « Ouvrir MEDACAP » → loader pont → dashboard embed
6. `/` connecté → vérifier fond portail + sections zebra

---

## 10. Carte des fichiers importants

```
frontend/src/
├── pages/portal/
│   ├── Portal.jsx                    # Dashboard + loader entrée
│   ├── DpsBrandCompetencyDetail.jsx  # Fiche marque compétences
│   ├── DpsTechnicianPifDetail.jsx    # Fiche PIF technicien
│   └── MedacapLaunch.jsx             # Pont loader → MEDACAP
├── components/
│   ├── DpsFilialePifSection.jsx      # Section PIF dashboard
│   ├── DpsBrandCompetencyDetailView.jsx
│   └── DpsBrandTierTechniciansTable.jsx
├── medacap/define/technician/        # Réplique React Define
├── utils/
│   ├── dpsMetrics.js                 # Agrégats, tableaux, level vs brand*
│   ├── launchMedacapExternal.js      # Ouverture MEDACAP
│   └── medacapDefine.js              # URLs SSO Define
└── data/mock_lms.js                  # Données démo DPS

scripts/medacap-api/                  # Pont PHP local WAMP
docs/                                 # Docs métier MEDACAP + DPS
```

---

## 11. En une phrase

**CFAO Academy** unifie vitrine et portail persona ; le **portail DPS** consomme **MEDACAP** pour afficher compétences (tableaux par marque) et PIF (réplique React + embed Define), en respectant le modèle paliers/marques documenté dans `docs/medacap-competency-model.md`.

---

*Rapport mis à jour le 14 juillet 2026 — session Cursor portail DPS / vitrine / intégration MEDACAP.*
