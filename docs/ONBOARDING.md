# Guide du nouveau développeur — CFAO Academy

> **Pour qui ?** Tu arrives sur le projet sans connaître l'historique. Ce guide explique **à quoi sert quoi**, **ce qui est déjà fait**, **ce qui est encore du prototype**, et **comment démarrer en local**.
>
> **État du projet au : juin 2026** — à mettre à jour quand un jalon PERT est franchi.

---

## 1. C'est quoi ce projet ?

**CFAO Academy** est la plateforme de formation du groupe CFAO (automobile, équipement, carrosserie, SAV…). Elle comporte deux grandes parties :

| Partie | Pour qui ? | Exemple |
|--------|------------|---------|
| **Site public (vitrine)** | Visiteurs, prospects | Catalogue formations, actualités, contact |
| **Portail connecté** | Collaborateurs CFAO selon leur rôle | Apprenant, formateur, KI/PIC, RH, admin… |

**15 applications métier** numérotées 00 à 15 (migration, LMS, sessions, recrutement, pilotage projet…). La liste complète : [PLATFORM_APPS.md](../PLATFORM_APPS.md).

---

## 2. Où en est-on ? (juin 2026)

### En une phrase

On a un **socle technique qui tourne** (auth, autorisation, APIs squelettes, CI) et un **frontend riche en données fictives** ; la **vraie logique métier** (org, LMS, sessions…) est **à construire** sur ce socle.

### Carte d'avancement (graphe PERT)

Le build est planifié en nœuds **A → B → C → D → … → J** (gate go-live). Détail : [planning.md](../planning.md).

```
[A Infra+CI] ──► [B Identity] ──► [C Authz] ──► [D LMS] ──► [M Migration] ──► [J Go-live]
     ✅              🔜                partiel         ❌              ❌              ❌
```

| Nœud | Nom | Statut juin 2026 | Ce que ça veut dire concrètement |
|------|-----|------------------|----------------------------------|
| **A** | Infra + CI | **✅ Fait (socle)** | Docker Compose, Keycloak, Cerbos, gateway, CI GitHub, générateur de modules |
| **B** | Identity (apps 11·12) | **🔜 Prochaine grosse étape** | Arbre org, comptes, rôles en base — pas encore l'app complète |
| **C** | Authz Cerbos | **🟡 Amorcé** | Policies + tests + patron `/me` ; à étendre à chaque nouveau module |
| **D** | LMS (apps 01·02·03) | **❌ À faire** | Parcours apprenant, QCM, certifications |
| **E** | Ops Node (apps 04·05·06·08) | **🟡 Squelette** | Service Node avec `/health` et `/me` ; pas encore sessions/salles |
| **F** | CMS Wagtail | **❌ À faire** | Blog public server-side (remplacera une partie du React vitrine à terme) |
| **M** | Migration (epic 00) | **❌ À faire** | Import org, comptes, catalogue prod |
| **J** | Gate go-live | **❌ À faire** | Checklist avant ouverture aux vrais utilisateurs |

**Story `00-6` (realm Keycloak en config-as-code)** : ✅ faite — fichier `keycloak/config/cfao-realm.yaml`, 22 rôles, clients OAuth, users démo.

**BFF (oauth2-proxy)** : préparé mais **pas activé** dans `docker-compose.yml` (login portail encore en mode dev / mock côté front).

### Ce qui marche vraiment aujourd'hui

| Zone | Réalité |
|------|---------|
| Site vitrine React (`frontend/`) | **UI complète** alimentée par **fichiers JSON** (`data/`, `catalogues/`) — pas d'API backend pour le catalogue |
| Login / portail | **Simulation** : profils dans `mock_profiles.json`, session `sessionStorage` — **pas Keycloak branché au front** |
| API `cfao-core` | Endpoint de référence **`GET /api/v1/core/me`** (JWT + Cerbos) — gabarit sécurité |
| API `cfao-operations` | **`/health`** + **`/me`** — même patron |
| CI | Cerbos, pytest Django, build Node, build Vite, scan secrets |

### Ce qui est encore du « faux » (normal à ce stade)

- Données LMS du portail → `mock_lms.js`, `mock_delivery.js`
- Connexion utilisateur → pas de vrai OIDC dans le navigateur (sauf test manuel curl + token Keycloak)
- Formulaire contact → pas d'envoi email réel
- Wagtail / CMS → pas encore dans le dépôt

---

## 3. Glossaire (version noob)

| Mot | Explication simple |
|-----|-------------------|
| **SPA** | Single Page App : le site charge une fois, React change les pages sans recharger tout le HTML |
| **Vite** | Outil qui lance et compile le frontend React en dev (`npm run dev`) |
| **Keycloak** | Le « guichet d'identité » : login, mots de passe, Google/Microsoft plus tard. Il délivre un **JWT** (jeton signé) |
| **JWT** | Carte d'identité numérique du user connecté. Chaque API vérifie ce jeton |
| **Cerbos** | Le « videur intelligent » : pour chaque action (« peut-il lire ce dossier ? »), il répond oui/non selon des **policies** YAML |
| **AuthN vs AuthZ** | **AuthN** = *qui es-tu ?* (Keycloak). **AuthZ** = *as-tu le droit ?* (Cerbos) |
| **PEP** | Point où l'API **vérifie** Cerbos avant de répondre. Chez nous : obligatoire sur chaque endpoint |
| **Default-deny** | Par défaut **tout est interdit** ; on ouvre explicitement dans les policies |
| **BFF** | Backend For Frontend : petite couche (oauth2-proxy) qui gère le login et pose un cookie sécurisé au navigateur |
| **Gateway (nginx)** | Porte d'entrée unique : route `/api/v1/core` → Django, `/api/v1/ops` → Node |
| **Django / DRF** | Framework Python pour `cfao-core` + API REST |
| **Epic / story `NN-x`** | **Epic** = grosse fonctionnalité (ex. app 02 LMS). **Story** = ticket précis (`02-3` = une user story du backlog) |
| **MOA** | Maîtrise d'ouvrage — le client métier qui reçoit le rapport hebdo |
| **PERT** | Planification par étapes avec dépendances (voir `planning.md`) |

---

## 4. Le dépôt, dossier par dossier

```
cfaoacademy/
│
├── frontend/          ← Site React (vitrine + portail). C'est souvent ta zone si tu fais du UI.
│   ├── src/pages/     ← Une page = une route (/contact, /portail, …)
│   ├── src/components/← Briques réutilisables (cartes, header, carrousel…)
│   ├── src/data/      ← JSON sessions, articles, index navigation
│   ├── src/i18n/      ← Textes FR (et PT) par écran
│   ├── src/styles/    ← CSS global (index.css, academy.css, portal.css)
│   └── public/        ← Images, assets statiques
│
├── cfao-core/         ← Backend Python principal (identity, futur lms, analytics…)
│   ├── core/          ← Auth JWT, Cerbos, modèles de base — NE PAS casser
│   ├── identity/      ← Premier module métier (en cours) + /me
│   └── config/        ← Settings Django, URLs
│
├── cfao-operations/   ← Backend Node (sessions, salles, planning — à venir)
│
├── cerbos/            ← Règles d'autorisation (YAML) + tests obligatoires
├── keycloak/          ← Config du realm (rôles, clients OAuth)
├── gateway/           ← Config nginx (+ oauth2-proxy à activer)
│
├── catalogues/        ← Fiches formations PNG/PDF par marque (gros fichiers)
├── data/              ← Données éditoriales partagées (sessions 2026, catalogue…)
├── wireframes/        ← Maquettes HTML de référence UX (pas l'app prod)
│
├── scripts/           ← Outils (ex. new_module.py = générateur app Django)
├── docs/              ← Index doc + ce guide
└── .github/           ← CI, templates PR, Dependabot
```

### Fichiers doc importants (racine)

| Fichier | Quand le lire |
|---------|---------------|
| [README.md](../README.md) | Premier contact, commandes rapides |
| [architecture.md](../architecture.md) | Comprendre la big picture technique |
| [BACKEND.md](../BACKEND.md) | Lancer Docker, tester les APIs |
| [backlog.md](../backlog.md) | Toutes les user stories |
| [planning.md](../planning.md) | Ordre de livraison et dépendances |
| [PLATFORM_ROLES.md](../PLATFORM_ROLES.md) | Les 22 rôles et leurs scopes |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | **Obligatoire** — format des commits et rapport MOA |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | Couleurs, composants UI |

---

## 5. Les 15 apps en langage humain

| N° | Nom | En clair |
|----|-----|----------|
| 00 | Migration | Importer les données du monde actuel avant d'ouvrir aux users |
| 01 | Site public | Catalogue, actus, contact (vitrine) |
| 02 | Espace apprenant | « Mes formations », progression, attestations |
| 03 | Espace KI/PIC | Former les juniors sur le terrain (formateur suppléant) |
| 04 | Formateur Academy | Animer les sessions officielles constructeur |
| 05 | Salles | Réserver ateliers et équipements |
| 06 | Assistance | Tickets support formateurs |
| 07 | Analytics | Tableaux de bord (lecture seule) |
| 08 | Sessions | Planning sessions, inscriptions, présences |
| 09 | Recrutement | Pipeline candidats → embauche → apprenant |
| 10 | Reporting | Rapports consolidés |
| 11·12 | Identity | Org (filiales, agences…), comptes, rôles |
| 13 | CMS | Blog / contenus Wagtail |
| 14 | Notifications | Emails et notifs in-app |
| 15 | Delivery | Pilotage projet, webhooks Git, **rapport MOA vendredi** |

---

## 6. Premier jour — installation pas à pas

### Prérequis sur ta machine

- **Git**
- **Node.js 20+** (frontend + cfao-operations)
- **Python 3.12+** (cfao-core en local hors Docker)
- **Docker Desktop** (pour le socle backend complet)

### Option A — Tu travailles sur le site / portail (frontend)

```bash
git clone <url-du-repo>
cd cfaoacademy/frontend
npm ci
npm run dev
```

→ Ouvre http://localhost:5173

- Page d'accueil, formations, contact : **données JSON locales**
- Login : choisis un profil démo (données mock) — pas besoin de Docker pour ça
- Règles UI et pièges connus : `.cursor/rules/cfaoacademy-project.mdc` (si tu utilises Cursor)

### Option B — Tu travailles sur le backend

```bash
cd cfaoacademy
cp .env.example .env    # change les mots de passe « change-me »
docker compose up --build
```

| URL | Usage |
|-----|-------|
| http://localhost:8000/healthz | Gateway vivant ? |
| http://localhost:8080 | Console Keycloak (admin / mot de passe .env) |
| http://localhost:8000/api/v1/core/me | Test chaîne JWT + Cerbos (avec un vrai token) |

Tests sans Docker pour Django :

```bash
cd cfao-core
pip install -r requirements.txt
pytest -q
```

### Option C — Tout vérifier comme la CI

```bash
make test
```

(ou voir [README.md](../README.md) § Tests)

---

## 7. Comment on travaille en équipe

### Une seule équipe GitHub

Revue de code : équipe **`@cfao-academy/academy`** (voir [.github/CODEOWNERS](../.github/CODEOWNERS)).

### Branches

| Branche | Rôle |
|---------|------|
| `main` | Référence stable |
| `develop` | Intégration |
| `feature/...` | Ton travail quotidien |

### Commits — règle d'or

Chaque commit significatif d'une story backlog :

```text
02-3: téléchargement des attestations PDF

Avancement: Les apprenants peuvent désormais télécharger leurs attestations
depuis leur espace, au format PDF.

- détail technique optionnel
```

- **`NN-x`** = ID story dans [backlog.md](../backlog.md)
- **`Avancement:`** = phrase reprise dans le **mail MOA du vendredi** (app 15)

➡️ Lis [CONTRIBUTING.md](../CONTRIBUTING.md) en entier.

### Pull requests

- Template automatique : contexte, story, checklist, tests
- La **CI doit être verte** (Cerbos, pytest, builds, Gitleaks)
- Pas de secrets dans le diff

### Statut hebdomadaire (jeudi)

Commit dédié :

```text
delivery: statut-hebdo 2026-W24
```

avec sections `Avancements:`, `Objectifs-en-cours:`, etc. — cf. CONTRIBUTING §3.

---

## 8. Frontend : où chercher quoi

| Besoin | Fichier / dossier |
|--------|-------------------|
| Routes | `frontend/src/App.jsx` |
| Page d'accueil | `frontend/src/pages/Accueil.jsx` |
| Sessions planning 2026 | `data/sessions-2026.json` → `frontend/src/data/sessions.js` |
| Textes traduits | `frontend/src/i18n/` |
| Image fiche formation manquante | `catalogues/{marque}/` + `utils/formationFiche.js` |
| Styles cartes / sections | `styles/academy.css`, `styles/index.css` |
| Portail par rôle | `frontend/src/pages/portal/` |

**Astuce** : le site public et le portail sont **dans le même projet React** aujourd'hui. À terme, le public pourra aussi passer par **Wagtail** (architecture cible) — ne confonds pas avec `wireframes/` qui est une maquette à part.

---

## 9. Backend : le patron à ne pas réinventer

Chaque nouvelle app Django doit suivre la chaîne sécurisée :

```
Requête + JWT  →  validation Keycloak  →  principal (rôles, scopes)
       →  Cerbos (oui/non)  →  réponse API
```

**Ne jamais** :
- exposer un endpoint sans check Cerbos ;
- committer un `.env` avec de vrais secrets ;
- merger une policy Cerbos sans test négatif (« un user sans droit est bien refusé »).

**Générer un nouveau module** (quand tu attaques une app métier) :

```bash
python scripts/new_module.py catalog Course --dry-run   # aperçu
python scripts/new_module.py catalog Course             # génère code + policy + tests
```

Détail : [BACKEND.md](../BACKEND.md).

---

## 10. Prochaines étapes projet (ce qui arrive)

Ordre prévu sur le **chemin critique go-live** :

1. **B — Identity** : structure org + comptes en base, lien Keycloak
2. **C — Authz** : policies Cerbos pour chaque ressource métier
3. **D — LMS** : parcours apprenant, QCM (gros morceau)
4. **E partiel** : sessions si dans le périmètre release 1
5. **M — Migration** : importer prod (org, users, catalogue)
6. **J — Gate** : smoke tests par rôle, validation MOA, ouverture

En parallèle (ne bloque pas le go-live) : analytics, recrutement complet, notifications avancées, reporting MOA automatisé (K₂).

---

## 11. FAQ débutant

**Je ne vois pas mes changements CSS sur l'accueil.**  
Vérifie `index.css` vs `academy.css`, et les règles de section (fond semi-transparent). Voir les pièges dans `.cursor/rules/cfaoacademy-project.mdc`.

**Pourquoi deux backends (Django et Node) ?**  
Django = cœur métier stable (identity, LMS). Node = opérations plus transactionnelles (sessions, planning). Un seul login Keycloak pour les deux.

**Je dois brancher le front sur l'API — par où ?**  
D'abord attendre ou contribuer au nœud **B/C** ; ensuite remplacer les imports `mock_*` par des appels `fetch` vers le gateway (`/api/v1/core/...`). Le BFF simplifiera le login navigateur.

**Qui contacter ?**  
Équipe **academy** sur GitHub. Pour la sécurité : [SECURITY.md](../SECURITY.md).

---

## 12. Checklist « je suis prêt à coder »

- [ ] Repo cloné, `npm run dev` ou `docker compose up` fonctionne
- [ ] Lu ce guide + [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Identifié ma story dans [backlog.md](../backlog.md) (`NN-x`)
- [ ] Compris si je touche au **mock front** ou au **vrai backend**
- [ ] Branch `feature/...` créée depuis `develop`
- [ ] Je sais écrire la ligne `Avancement:` pour le MOA

Bienvenue dans l'équipe.

**Déploiement Azure / CD** : voir [DEPLOYMENT.md](./DEPLOYMENT.md).
