# CFAO Academy — Architecture Backend

Référence d'architecture pour la plateforme de formation CFAO Academy.
Stack : **Keycloak** (authentification) · **Cerbos** (autorisation) · **Django/DRF** + **Node** (services métier) · **PostgreSQL** · **Docker Compose**.

---

## 1. Principes directeurs

- **Pas de sur-ingénierie.** On ne déploie ni Kubernetes, ni bus d'événements lourd au démarrage. Docker Compose suffit pour faire tourner toute la plateforme.
- **Séparer authentification et autorisation.** Keycloak authentifie (jetable/remplaçable par Okta plus tard) ; Cerbos autorise à partir d'attributs que *nous* possédons. Changer d'IdP ne touche jamais les permissions.
- **Une source de vérité par donnée.** Le module Identité possède l'arbre org et les scopes ; le LMS possède les certifications ; les Opérations possèdent les sessions. Pas de base partagée.
- **Monolithe modulaire d'abord.** Le nouveau code vit dans un seul projet Django découpé en modules qui correspondent aux contextes métier. Les frontières sont nettes, donc l'extraction en services séparés reste possible et bon marché plus tard.

---

## 2. Topologie runtime

```
                        ┌──────────────┐
            login       │   Keycloak   │   (authN, OIDC, émet le JWT)
        ┌──────────────▶│  + keycloak-db│
        │               └──────────────┘
        │
   ┌─────────┐   JWT     ┌──────────────────────────────┐
   │ Client  │──────────▶│      Reverse proxy (nginx)    │  TLS + routage
   │ (SPA)   │           └───────────────┬──────────────┘
   └─────────┘                           │
                          ┌──────────────┴───────────────┐
                          ▼                              ▼
              ┌────────────────────────┐    ┌──────────────────────────┐
              │   cfao-core (Django)   │    │  cfao-operations (Node)  │
              │  identity · recruitment│    │  sessions · rooms ·      │
              │  lms · analytics       │    │  planning · tickets      │
              │  + core-db (Postgres)  │    │  + ops-db (Postgres)     │
              └───────────┬────────────┘    └────────────┬─────────────┘
                          │   check / query plan          │
                          └───────────┬───────────────────┘
                                      ▼
                              ┌──────────────┐
                              │    Cerbos    │  (authZ, PDP partagé)
                              │  policies/   │
                              └──────────────┘
```

Deux services métier seulement, un PDP Cerbos partagé, un Keycloak. Le client tape les deux services derrière un reverse proxy ; chacun valide le même JWT Keycloak et délègue la décision d'accès à Cerbos.

> **Décision front (à ne pas remettre en question par réflexe).** Le portail est un **SPA React/Vite en client-side rendering — pas de Next.js, pas de SSR.** Le SEO est porté par **Wagtail** (rendu server-side du site public) ; le portail étant authentifié, son contenu n'est ni indexé ni crawlé, donc le CSR suffit et reste le plus simple (fichiers statiques + BFF). Next.js n'aurait de sens que pour un frontend React **unique** couvrant aussi le public (headless Wagtail + SSR) — architecture écartée. La stack front est donc : **Wagtail server-side pour le public + SPA React/Vite pour le portail**, deux frontends distincts.

---

## 3. Découpage en modules (les 16 apps → 2 services + 1 module détachable)

| Service | Module | Apps couvertes | Possède |
|---------|--------|----------------|---------|
| **cfao-core** (Django) | `identity` | 11 · 12 | Arbre org, comptes, rôles, scopes, provisioning Keycloak |
| | `recruitment` | 09 | Candidats, pipeline RH, décision, bascule → learner — **assigne** des évaluations ; ne possède pas les QCM |
| | `lms` | 01 · 02 · 03 | Catalogue public, parcours, modules, **QCM / évaluations** (moteur partagé apprenants + candidats), compétences, certifications, espace KI/PIC |
| | `analytics` | 07 · 10 | Read models, dashboards, reporting (lecture seule) |
| | `cms` (Wagtail) | 01 (blog) | Blog vitrine : articles événements, formations passées, certifications, nouveautés |
| | `notifications` | 14 | Emails & notifications in-app, pilotés par les événements métier |
| | `delivery` | 15 | Pilotage projet (roadmap, backlog, gate migration, statut tests) ; **ingestion Git** (webhooks push) ; **digest hebdomadaire** email |
| **cfao-operations** (Node) | `sessions` | 08 | Sessions, inscriptions, présences, résultats |
| | `rooms` | 05 | Réservation salles & équipements |
| | `planning` | 04 | Planning & contenus formateurs |
| | `tickets` | 06 | Assistance formateurs |
| **cfao-needs** (Django, **détachable**) | `needs` | **16** | Campagnes de recueil des besoins, référentiel de campagne, soumissions par filiale, emailing de campagne |

> **`cfao-needs` est un troisième déployable, pas un module de `cfao-core`.** Il embarque son propre Keycloak, son propre Cerbos et sa propre base en mode `standalone`, et bascule vers ceux de la plateforme en mode `integrated` par variables d'environnement — jamais par modification de code. Toute dépendance à la plateforme passe par une interface (`ReferentialSource`, `IdentityProvider`) à deux implémentations. Raison d'être : la campagne 2027 doit partir avant la livraison du nœud E. Détail → **`docs/SPEC_RECUEIL_BESOINS_2027.md`**, `planning.md` §2 nœud **N**.

> `analytics` reste un module Django pour l'instant. Si le besoin de perf/async se fait sentir, on l'extrait en service FastAPI séparé — sans rien changer aux autres modules.

> Le module `cms` s'appuie sur **Wagtail en mode intégré (rendu server-side)** : Wagtail sert lui-même les pages publiques (vitrine + blog), ce qui donne le SEO et la prévisualisation des brouillons nativement — sans imposer un SSR React. Le **portail authentifié** (apps 02–12, **15**) reste la SPA React derrière le BFF : ce sont donc **deux frontends distincts** aux besoins opposés (public = ouvert/SEO, portail = authentifié). Le gateway route le public (`/`, `/blog`) vers Wagtail **sans auth**, et `/app` + `/api` vers le BFF. Wagtail rend aussi les pages catalogue à partir de l'API interne du module `lms` (le `lms` **possède** la donnée, Wagtail la **présente**). L'API headless de Wagtail n'est exposée que si le portail doit un jour embarquer du contenu CMS — optionnel.

> Le workflow éditorial (brouillon → relecture → publication) est géré par Wagtail nativement ; Cerbos ne gate que l'accès au CMS via un rôle **`content_editor`** (scope filiale ou groupe). Les éditeurs s'authentifient à l'admin Wagtail via Keycloak ; les lecteurs du blog public ne s'authentifient pas.

> Le module `notifications` est **piloté par les événements** : il s'abonne au flux métier des deux services et envoie en **asynchrone** (worker) — les émetteurs ignorent la logique d'envoi. Fournisseur d'email transactionnel **abstrait** derrière une interface (SES / SendGrid / Azure Communication Services), templates localisés, préférences opt-in/opt-out, et scheduler pour les notifications temporelles (rappels, certifs expirantes). C'est le cas qui justifiera un vrai broker quand le volume montera.

---

## 4. Arborescence backend

### 4.1 Racine du dépôt

```
cfao-academy/
├── docker-compose.yml          # keycloak, cerbos, core, operations, dbs, gateway
├── .env.example
├── README.md
├── ARCHITECTURE.md             # ce document
├── gateway/
│   └── nginx.conf              # reverse proxy : TLS + routage /api/core, /api/ops
├── cerbos/                     # policies d'autorisation (partagées par les 2 services)
├── cfao-core/                  # service Django
└── cfao-operations/            # service Node
```

### 4.2 cfao-core (Django + DRF)

```
cfao-core/
├── manage.py
├── pyproject.toml              # django, djangorestframework, psycopg, cerbos-sdk, PyJWT/jwcrypto, django-pgtrigger, wagtail, django-q2
├── Dockerfile
├── .env.example
├── config/                     # projet Django
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py
│   │   └── prod.py
│   ├── urls.py                 # /api/v1/ + admin/
│   ├── asgi.py
│   └── wsgi.py
│
├── core/                       # transverse — réutilisé par tous les modules
│   ├── auth/
│   │   ├── oidc.py             # validation du JWT Keycloak via JWKS
│   │   └── principal.py        # construit le "principal" Cerbos (token + scope DB)
│   ├── authz/
│   │   ├── cerbos.py           # client Cerbos : check_resource() + plan_resources()
│   │   ├── permissions.py      # DRF permission class → appelle Cerbos (PEP)
│   │   └── filters.py          # traduit le query plan Cerbos en filtre queryset
│   ├── pagination.py
│   ├── exceptions.py
│   └── models.py               # TimeStampedModel, UUIDModel, mixins
│
├── identity/                   # apps 11 + 12
│   ├── models.py               # Group, Region, Branch, Agency, Department, Brand,
│   │                           #   User, RoleAssignment (rôle + scopeNode + brands)
│   ├── serializers.py
│   ├── views.py
│   ├── services.py             # provisioning Keycloak, calcul de orgPath
│   ├── admin.py                # back-office Django = UI des apps 11/12
│   └── urls.py
│
├── recruitment/                # app 09
│   ├── models.py               # Candidate, CandidateAssessment (→ lms.Evaluation), HiringDecision
│   ├── serializers.py
│   ├── views.py
│   ├── services.py             # assign_evaluation(), promote_to_learner() → identity + lms
│   └── urls.py
│
├── lms/                        # apps 01 + 02 + 03
│   ├── models.py               # Course, Module, Enrollment, Evaluation (QCM),
│   │                           #   Competency, Certificate, InstructorLink (KI/PIC)
│   ├── serializers.py
│   ├── views.py                # espace apprenant + espace KI/PIC
│   ├── catalog/                # vues publiques non authentifiées (app 01)
│   └── urls.py
│
├── analytics/                  # apps 07 + 10
│   ├── models.py               # read models matérialisés
│   ├── aggregators.py          # alimente les read models (depuis les événements)
│   ├── views.py                # dashboards + reporting (utilise le query plan Cerbos)
│   └── urls.py
│
├── cms/                         # app 01 (blog vitrine) — Wagtail
│   ├── models.py               # ArticlePage, BlogIndexPage (StreamField)
│   ├── api.py                  # endpoints headless (Wagtail REST API) si SPA
│   └── # workflow éditorial + admin fournis par Wagtail
│
├── notifications/               # app 14 — emails & notifs in-app (event-driven)
│   ├── handlers.py             # abonnés aux événements métier
│   ├── channels.py             # interface fournisseur (email transactionnel abstrait)
│   ├── templates/              # gabarits localisés (delivery/weekly_dev_reminder, weekly_digest_moa)
│   ├── preferences.py          # opt-in/opt-out par type
│   └── tasks.py                # envoi asynchrone (worker) + tâches planifiées
│
├── delivery/                    # app 15 — pilotage projet + reporting Git
│   ├── models.py               # Epic, Story, TestGate, GitPushEvent, WeeklyDigest, DigestRecipient
│   ├── git_webhooks.py         # POST push (GitHub/GitLab/Azure DevOps), vérif signature
│   ├── aggregators.py          # parse Avancement:, statut-hebdo, sections MOA (CONTRIBUTING.md)
│   ├── views.py                # roadmap, backlog, gate J, historique digests, validation rapport
│   ├── tasks.py                # send_weekly_dev_reminder (jeu), send_weekly_digest (ven)
│   └── urls.py
│
├── integration/                # liaison avec cfao-operations
│   ├── events.py               # publication/consommation (webhooks → broker plus tard)
│   ├── operations_client.py    # appels REST sortants vers le service Node
│   └── webhooks.py             # réception : résultats de session, etc.
│
└── tests/
```

### 4.3 cfao-operations (Node — existant, structure cible)

```
cfao-operations/
├── package.json
├── Dockerfile
├── .env.example
└── src/
    ├── server.ts
    ├── config/
    ├── middleware/
    │   ├── auth.ts             # valide le JWT Keycloak (JWKS)
    │   └── authz.ts            # PEP : appelle Cerbos avant l'action
    ├── modules/
    │   ├── sessions/           # app 08  (routes, service, repo)
    │   ├── rooms/              # app 05
    │   ├── planning/           # app 04
    │   └── tickets/            # app 06
    ├── lib/
    │   ├── cerbos.ts           # client Cerbos
    │   └── events.ts           # émet "session_completed" vers core
    └── db/
```

### 4.4 cerbos (policies partagées)

```
cerbos/
├── config.yaml                 # config du PDP (port, audit)
├── policies/
│   ├── _schemas/
│   │   ├── principal.json      # schéma des attributs principal (scopeNode, brands…)
│   │   └── resources/          # schémas par ressource
│   ├── derived_roles/
│   │   └── scope.yaml          # within_org_scope (factorisé, réutilisé partout)
│   └── resource_policies/
│       ├── account.yaml        # identity
│       ├── candidate.yaml      # recruitment
│       ├── course.yaml         # lms
│       ├── enrollment.yaml     # lms
│       ├── evaluation.yaml     # lms (KI/PIC)
│       ├── certificate.yaml    # lms
│       ├── session.yaml        # operations
│       ├── room_booking.yaml   # operations
│       ├── planning.yaml       # operations
│       └── ticket.yaml         # operations
└── tests/                      # tests de policy (cerbos compile --tests)
```

---

## 5. API

### 5.1 Conventions

- Base : `/api/v1/`. Le proxy route `/api/v1/core/*` → Django, `/api/v1/ops/*` → Node.
- Authentification : header `Authorization: Bearer <JWT Keycloak>`. Chaque service valide la signature via le JWKS de Keycloak.
- Autorisation : **chaque endpoint** appelle Cerbos avant d'agir (pattern PEP, voir §5.3).
- Format : JSON. Pagination par curseur. Erreurs normalisées `{ "error": { "code", "message", "details" } }`.
- Filtrage par périmètre : les endpoints de liste appliquent le **query plan Cerbos** au queryset — jamais de filtrage à la main.

### 5.2 Endpoints par module

**identity** (`/api/v1/core`)

| Méthode | Endpoint | Rôle attendu |
|---------|----------|--------------|
| GET/POST | `/org/branches` `/org/agencies` `/org/departments` `/org/brands` | admin (groupe/filiale) |
| GET/POST/PATCH | `/users` `/users/{id}` | admin filiale/groupe |
| POST | `/users/{id}/assignments` | admin — assigne rôle + scopeNode + brands |
| GET | `/me` | tout profil connecté — renvoie son scope résolu |

**recruitment** (`/api/v1/core`)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| GET/POST | `/candidates` `/candidates/{id}` | RH filiale/groupe |
| POST | `/candidates/{id}/assessments` | RH — assigne une **éval LMS** (réf. QCM par marque) |
| GET | `/candidates/{id}/assessments/{aid}` | candidat, RH — statut + lien passage QCM (délègue exécution au LMS) |
| PATCH | `/candidates/{id}/assessments/{aid}` | formateur (correcteur) — si correction hors QCM auto |
| POST | `/candidates/{id}/decision` | directeur filiale |
| POST | `/candidates/{id}/hire` | RH — déclenche la bascule → learner |

> Les QCM eux-mêmes vivent sous **`/evaluations`** (module `lms`). `recruitment` ne crée pas de questions : il lie un candidat à une `Evaluation` existante (filtrée par marque / type recrutement).

**lms** (`/api/v1/core`)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| GET | `/public/catalog` | public (non authentifié) |
| GET | `/courses` `/modules` | apprenant, KI/PIC |
| GET/POST/PATCH | `/enrollments` | apprenant (le sien), inscriptions |
| GET/POST/PATCH | `/evaluations` | KI/PIC (créer/maj), managers (lecture) |
| GET | `/certificates` `/certificates/{id}/pdf` | apprenant + hiérarchie |
| GET | `/instructor/learners` | KI/PIC — ses apprenants assignés |

**analytics** (`/api/v1/core`)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| GET | `/dashboard` | managers, directeurs (filtré par scope) |
| GET | `/reports/certifications` `/reports/hours` | directeurs, RH |
| GET | `/reports/export` | super admin |

**delivery** (`/api/v1/core`) — app 15, périmètre **projet** (pas scope filiale)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| GET/PATCH | `/delivery/epics` `/delivery/stories` | build_team, super admin |
| GET/PATCH | `/delivery/stories/{id}/test-gates` | build_team — statut TU/TI/contrat/E2E |
| GET/PATCH | `/delivery/migration/gate` | super admin — checklist gate **J** |
| GET/POST/PATCH | `/delivery/git/config` | super admin — repo, webhook secret |
| POST | `/delivery/webhooks/git` | **Git provider** (HMAC, sans JWT utilisateur) |
| GET/POST/PATCH | `/delivery/digest/recipients` | super admin — destinataires MOA + planning **rappel jeudi** / **rapport vendredi** |
| GET | `/delivery/digest/history` `/delivery/digest/{id}` | super admin, admin groupe, dir. groupe |
| POST | `/delivery/digest/preview` | build_team, tech lead — brouillon corps MOA + annexe |
| PATCH | `/delivery/digest/{id}/approve` | tech lead, super admin — valide avant envoi auto vendredi |
| POST | `/delivery/digest/send` | super admin — envoi manuel (hors cron) |

> **Flux reporting MOA** (conventions commits : `CONTRIBUTING.md`).
>
> 1. **Lundi–jeudi** — push Git → webhook → `GitPushEvent` ; extraction `NN-x`, ligne `Avancement:`.
> 2. **Jeudi** *(planifié)* — `send_weekly_dev_reminder` : email aux devs mappés + `build_team` — compléter statut `delivery: statut-hebdo YYYY-Www` et lignes `Avancement:` avant vendredi.
> 3. **Vendredi** *(planifié)* — `send_weekly_digest` : `aggregators` fusionne statuts hebdo + avancements ; génère mail **formel MOA** (synthèse, avancements, objectifs en cours, objectifs semaine prochaine, goulots) ; annexe technique (commits, auteurs) séparée ou masquée.
> 4. **Optionnel** — tech lead valide le brouillon via `preview` + `approve` avant envoi auto.
>
> Templates : `delivery/weekly_dev_reminder`, `delivery/weekly_digest_moa`. Canal : `notifications.channels.send_email`.

**cms / blog** (Wagtail, rendu server-side)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| pages | `/`, `/blog`, `/blog/{slug}` — rendues par Wagtail | public (non authentifié) |
| admin | `/cms-admin` — rédaction, relecture, publication | `content_editor` |
| GET | `/api/v2/pages` — API headless (optionnel, si le portail embarque du contenu) | selon besoin |

**operations** (`/api/v1/ops`, service Node)

| Méthode | Endpoint | Rôle |
|---------|----------|------|
| GET/POST/PATCH | `/sessions` `/sessions/{id}` | assistante, directeur centre |
| POST | `/sessions/{id}/attendance` `/sessions/{id}/results` | formateur (ses sessions) |
| GET/POST | `/rooms/bookings` | formateur, KI/PIC, assistante |
| GET/POST | `/planning` | formateur, assistante, directeur centre |
| GET/POST | `/tickets` `/tickets/{id}` | formateur, KI/PIC (créer), assistante (traiter) |

### 5.3 Flux d'autorisation par requête (PEP → PDP)

Chaque endpoint suit le même schéma, quel que soit le langage :

```
1. Le middleware valide le JWT Keycloak (signature via JWKS).
2. On construit le PRINCIPAL Cerbos :
   { id, roles: [...], attr: { scopeNode, departments, brands } }
   (rôles depuis le token ; scope résolu depuis identity / cache)
3a. Action sur UNE ressource (read/create/update/delete) :
    → on charge la ressource, on construit son attr { orgPath, department, brand }
    → cerbos.check_resource(principal, resource, action) → ALLOW / DENY
3b. LISTE de ressources (dashboard, reporting) :
    → cerbos.plan_resources(principal, "read", kind)
    → on traduit le plan renvoyé en filtre queryset (core/authz/filters.py)
    → on n'expose que ce qui est dans le périmètre
```

Le « scopeNode dans orgPath » règle toute la hiérarchie org en une comparaison (cf. policy `evaluation.yaml`). Brand et department sont des filtres additionnels combinés en **ET** dans le bloc `condition` de la règle.

> **Note d'implémentation (étape 3b).** Cerbos ne fournit **pas** d'adaptateur de query plan pour Django ORM (seulement SQLAlchemy, Prisma, Drizzle, etc.). `core/authz/filters.py` est donc à écrire à la main : parser l'AST du plan vers des objets `Q`, en s'inspirant de l'adaptateur SQLAlchemy. Et `scopeNode in orgPath` (scalaire ∈ attribut-liste) demande un **opérateur custom** émettant `:scope = ANY(org_path)`. À chiffrer dans le planning — détails dans `ARCHITECTURE-complements.md` §1.

### 5.4 Intégration inter-services (événements)

On commence **simple** : des appels REST / webhooks directs. On ajoutera un broker (RabbitMQ/Redis) seulement quand le volume ou le besoin de découplage le justifiera.

> **Graphe PERT** (dépendances build + flèches webhook) : voir `planning.md` §1–§3.

| Événement | Émetteur | Consommateur | Effet |
|-----------|----------|--------------|-------|
| `candidate_hired` | recruitment | identity → lms | crée le compte terrain + profil apprenant + parcours initial |
| `assessment_completed` | lms | recruitment | met à jour le dossier candidat (score, réussite) |
| `session_completed` (résultats) | operations (Node) | lms (webhook `integration/webhooks`) | met à jour compétences & certifications |
| `enrollment_created` / `certificate_issued` | lms | analytics | rafraîchit les read models |
| `org_restructured` (réorg, rare) | identity | operations, analytics | recalcul **batch** des `orgPath` dénormalisés hors `core` (cf. complément §1) |
| `ticket_resolved` | operations | notifications | email/notif au demandeur |
| `assessment_assigned` | recruitment | notifications | notifie le candidat |
| `ki_training_assigned` | lms | notifications | notifie le KI/PIC (formation à dispenser) |
| `session_assigned` | operations | notifications | notifie le formateur |

> Le module `notifications` est aussi abonné à `enrollment_created`, `certificate_issued`, `session_completed`, etc. — il consomme largement le flux d'événements. Les rappels de session et certifs expirantes sont eux **planifiés** (scheduler), pas déclenchés par un événement.

### 5.4 bis · Intégration Git (app 15 — hors événements métier formation)

| Source | Mécanisme | Donnée ingérée |
|--------|-----------|----------------|
| GitHub | Webhook `push` (+ option `pull_request` merged) | commits, auteur, branches, diff stats |
| GitLab | System hook / project hook `push` | idem |
| Azure DevOps | Service hook `git.push` | idem |

Sécurité : secret partagé ou signature HMAC par fournisseur ; route `/delivery/webhooks/git` **sans** JWT utilisateur (comme webhook ops→core). Mapping auteur Git → membre équipe en base `delivery`.

**Parsing des messages** (cf. `CONTRIBUTING.md`) :

| Pattern | Usage |
|---------|--------|
| Sujet `NN-x:` | Rattachement backlog |
| Ligne `Avancement:` | Phrase reprise dans le corps MOA (français, non technique) |
| Sujet `delivery: statut-hebdo YYYY-Www` | Statut hebdomadaire obligatoire par dev actif |
| Sections `Avancements:` / `Objectifs-en-cours:` / `Objectifs-semaine-prochaine:` / `Goulots:` | Blocs agrégés dans le mail vendredi |

**Calendrier emails** (défaut configurable app 15) :

| Tâche | Jour | Destinataires | Ton |
|-------|------|---------------|-----|
| `send_weekly_dev_reminder` | **Jeudi** | Devs (auteurs Git mappés) + `build_team` | Rappel opérationnel + lien `CONTRIBUTING.md` |
| `send_weekly_digest` | **Vendredi** | MOA, direction, sponsors (liste configurée) | **Formel, institutionnel** — pas de jargon ; détails Git en annexe |

Indépendant du flux événementiel §5.4 ; réutilise uniquement le **canal email** du module `notifications`.

### 5.5 Stratégie de tests (par fonctionnalité)

Chaque story livrée suit la séquence **TU → TI → contrat → E2E** (détail, outils, DoD : `planning.md` §6).

| Niveau | Cible dans cette architecture |
|--------|-------------------------------|
| **TU** | `core/*/tests/`, `cfao-operations` modules, `cerbos/tests/`, composants frontend |
| **TI** | Endpoint + Postgres de test **par service** ; signals Django ; PEP Cerbos mocké ou embarqué |
| **Contrat** | OpenAPI `/api/v1/core/*` ↔ `/api/v1/ops/*` ; payloads webhook §5.4 (`session_completed`, `assessment_completed`, …) + secret HMAC |
| **E2E** | Stack Compose staging : oauth2-proxy → gateway → apps ; parcours par rôle (`00-7` = smoke transverse avant gate go-live) |

Les **tests de contrat** sont obligatoires dès qu'une story touche une frontière inter-service (y compris webhooks du graphe PERT). Les **E2E** couvrent le parcours métier visible ; ils s'accumulent en CI et sont rejoués intégralement avant la gate **J** (`planning.md` §4).

---

## 6. Authentification : du token Keycloak au principal Cerbos

Côté navigateur, la SPA n'obtient jamais ce JWT : un **BFF** gère le flow OIDC et ne lui transmet qu'un cookie de session httpOnly (cf. `ARCHITECTURE-complements.md` §5) ; le BFF réinjecte le Bearer vers les services. Les deux stratégies ci-dessous concernent la façon dont le *service* remplit le `principal.attr` que Cerbos évalue, à partir de ce Bearer :

- **Claims dans le token** (protocol mapper Keycloak) : `scopeNode`, `departments`, `brands` injectés à la connexion. Simple, rapide, mais nécessite un refresh du token quand le scope change.
- **Résolution côté service** (recommandée comme source de vérité) : le token ne porte que `sub` + rôles ; le service charge le scope depuis le module `identity` (avec cache). Toujours à jour, scope possédé par nous.

Exemple de claims émis :

```json
{
  "sub": "u_123",
  "preferred_username": "j.kamga",
  "realm_access": { "roles": ["ki"] },
  "scopeNode": "br_cmr",
  "departments": ["motors"],
  "brands": ["toyota"]
}
```

> Règle d'or : le **scope org/dept/marque appartient au module identity, pas à Keycloak ni à l'AD.** L'annuaire authentifie et fournit au mieux des rôles grossiers ; le périmètre métier reste chez nous. C'est ce qui rend l'autorisation stable quel que soit l'IdP (Keycloak aujourd'hui, Okta demain).

---

## 7. Déploiement (docker-compose)

Services définis dans `docker-compose.yml` :

| Service | Image / base | Rôle |
|---------|--------------|------|
| `gateway` | nginx + **oauth2-proxy** | TLS, routage, **et BFF** : flow OIDC, cookie de session httpOnly, injection du Bearer vers les APIs |
| `keycloak` | quay.io/keycloak/keycloak (+ plugin bcrypt) | authentification |
| `keycloak-db` | postgres | base Keycloak |
| `cerbos` | ghcr.io/cerbos/cerbos | PDP, monte `./cerbos/policies` |
| `core` | build `./cfao-core` | service Django (identity, recruitment, lms, analytics, cms, notifications) |
| `core-db` | postgres | base du service core |
| `worker` | build `./cfao-core` (même image) | tâches asynchrones : envoi des notifications + tâches planifiées (Django-Q2, broker = Postgres, pas de Redis au départ) |
| `operations` | build `./cfao-operations` | service Node |
| `ops-db` | postgres | base du service operations |

Migration des comptes existants : le plugin bcrypt permet d'importer les hash actuels sans reset ; Keycloak ré-encode au format natif à la première connexion.

Config Keycloak : gérée en **config-as-code** via `keycloak-config-cli` (realm, clients, mappers en JSON/YAML versionné, appliqués sans redémarrage), pas de configuration manuelle dans la console — dérive détectable, démarrage reproductible.

---

## 8. Gestion des secrets

Aucun secret réel dans le dépôt : `.env.example` ne documente que la *forme* des variables. Les secrets à gérer : mots de passe des bases, identifiants admin Keycloak, secret du client `oauth2-proxy ↔ Keycloak`, cookie secret d'oauth2-proxy. (Les clés de signature des JWT ne se gèrent pas à la main : Keycloak les génère et les fait tourner lui-même ; elles sont couvertes par la sauvegarde de `keycloak-db`.)

**En production (Azure) — Azure Key Vault + Managed Identity.** L'application lit ses secrets au démarrage via `DefaultAzureCredential` : aucun secret n'est stocké pour aller chercher les secrets. Préfère une **user-assigned managed identity** plutôt que system-assigned — et attention à un piège réel : les managed identities *system-assigned* ne sont pas supportées avec une app multi-conteneurs sur App Service. Héberge donc sur **Azure Container Apps** (qui sait référencer un secret Key Vault via l'identité) ou sur une **VM** avec identité user-assigned, pas sur App Service multi-conteneurs.

> Pipeline CI/CD, registry Docker (ACR), limites GitHub Actions et choix Jenkins → **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

**En local — pas de secret stocké non plus.** `DefaultAzureCredential` retombe sur ton `az login` : le dev accède à un Key Vault de Dev avec sa propre identité, le même code marchant en dev et en prod. Pour des secrets purement locaux (sans Azure), utilise les `secrets:` de Docker Compose (montés en fichiers sous `/run/secrets/`), jamais un `.env` committé.

---

## 9. Évolutions différées (volontairement hors périmètre initial)

- **Kubernetes + OPA/Gatekeeper** : quand l'échelle le justifiera. OPA reste un objectif d'apprentissage, pas une dépendance à déployer maintenant.
- **Bus d'événements** (RabbitMQ/Redis) : à introduire quand les appels REST inter-services deviennent un point de friction, ou quand le volume de notifications le justifie (passage de Django-Q2/Postgres à Celery + Redis).
- **Extraction du module analytics en FastAPI** : si la charge de reporting l'exige.
- **Bascule Keycloak → Okta** : ajout d'Okta comme IdP brokeré dans Keycloak, sans toucher aux services.