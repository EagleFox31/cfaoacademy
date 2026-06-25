# CFAO Academy

Plateforme de formation CFAO : **site vitrine** (React/Vite), **portail apprenant** et **socle backend** (Keycloak · Cerbos · Django · Node).

> Dépôt interne — propriété CFAO. Voir [LICENSE](./LICENSE) et [SECURITY.md](./SECURITY.md).

## Quickstart (5 min)

### Site vitrine + portail (frontend)

```bash
cd frontend
npm ci
npm run dev          # http://localhost:5173
```

Les catalogues PNG/PDF sont synchronisés automatiquement (`predev` / `prebuild`) depuis `catalogues/` à la racine du dépôt.

### Socle plateforme (backend local)

```bash
cp .env.example .env   # ajuster les mots de passe de dev
docker compose up --build
```

| Service | URL |
|---------|-----|
| Gateway (API) | http://localhost:8000 |
| Keycloak | http://localhost:8080 |
| Cerbos | http://localhost:3592 |

Détails : [BACKEND.md](./BACKEND.md).

### Tout tester (comme en CI)

```bash
make test
# ou, sans Make : voir section « Tests » ci-dessous
```

## Structure du dépôt

```
cfaoacademy/
├── frontend/           # SPA React 19 + Vite — vitrine + portail (CSR)
├── cfao-core/          # Django/DRF — identity, lms, analytics…
├── cfao-operations/    # Node/TS — sessions, planning, salles…
├── cerbos/             # Policies d'autorisation (PDP)
├── gateway/            # nginx (+ oauth2-proxy à venir)
├── keycloak/           # Realm & config IdP
├── catalogues/         # Fiches formations (PNG/PDF par marque)
├── data/               # Données éditoriales (sessions, articles…)
├── scripts/            # Outils repo (ex. new_module.py)
├── docs/               # Index documentation
└── .github/            # CI, templates, CODEOWNERS, Dependabot
```

## Documentation

| Sujet | Fichier |
|-------|---------|
| Index complet | [docs/README.md](./docs/README.md) |
| **Nouveau développeur** | **[docs/ONBOARDING.md](./docs/ONBOARDING.md)** |
| Architecture backend | [architecture.md](./architecture.md) |
| **Déploiement (CD, ACR, Azure)** | **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** |
| Socle & démarrage Docker | [BACKEND.md](./BACKEND.md) |
| Apps plateforme (01–15) | [PLATFORM_APPS.md](./PLATFORM_APPS.md) |
| Rôles & permissions | [PLATFORM_ROLES.md](./PLATFORM_ROLES.md) |
| Design system front | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Vues apprenant | [APPRENANT_VIEWS.md](./APPRENANT_VIEWS.md) |
| Backlog & planning | [backlog.md](./backlog.md) · [planning.md](./planning.md) |
| Contribution (commits MOA) | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Historique des versions | [CHANGELOG.md](./CHANGELOG.md) |

## Tests

```bash
# Cerbos (policies + tests négatifs)
docker run --rm -v "$PWD/cerbos:/cerbos" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/cerbos/tests /cerbos/policies

# cfao-core (pytest, SQLite en mémoire)
cd cfao-core && pip install -r requirements.txt && pytest -q

# cfao-operations
cd cfao-operations && npm ci && npm run typecheck && npm test && npm run build

# frontend
cd frontend && npm ci && npm run build
```

La CI GitHub Actions exécute ces vérifications sur chaque PR (voir [.github/workflows/ci.yml](./.github/workflows/ci.yml)).

## Branches & releases

| Branche | Usage |
|---------|-------|
| `main` | Production / référence stable |
| `develop` | Intégration continue |
| `feature/*` | Travail quotidien (story `NN-x` dans les commits) |

Versionnement **SemVer** (`vMAJOR.MINOR.PATCH`). Les notes de version sont dans [CHANGELOG.md](./CHANGELOG.md).

## Contribution

1. **Nouveau sur le projet ?** Lire [docs/ONBOARDING.md](./docs/ONBOARDING.md).
2. Lire [CONTRIBUTING.md](./CONTRIBUTING.md) (format commits `NN-x:` + ligne `Avancement:`).
3. Ouvrir une PR avec le template fourni.
4. Attendre la revue des **CODEOWNERS** et le passage de la CI.

## Sécurité

- Ne jamais committer de secrets (`.env` est ignoré ; modèle dans `.env.example`).
- Signaler une vulnérabilité : [SECURITY.md](./SECURITY.md).
- Scan secrets (Gitleaks) et mises à jour deps (Dependabot) activés sur le dépôt.

## Stack (résumé)

| Couche | Technologie |
|--------|-------------|
| AuthN | Keycloak (OIDC / JWT) |
| AuthZ | Cerbos (default-deny, PEP sur chaque endpoint) |
| Core métier | Django 5 + DRF (`cfao-core`) |
| Opérations | Node 20 + Express + TypeScript (`cfao-operations`) |
| Front | React 19 + Vite + React Router (`frontend/`) |
| Données | PostgreSQL (2 instances : core + ops) |
| Local | Docker Compose |
