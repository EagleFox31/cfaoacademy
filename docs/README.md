# Index documentation — CFAO Academy

Point d'entrée pour la documentation du dépôt. Les fichiers listés ci-dessous sont à la **racine** du repo (migration progressive vers `docs/` possible).

## Démarrage

| Document | Contenu |
|----------|---------|
| [README.md](../README.md) | Quickstart, structure, tests, contribution |
| **[ONBOARDING.md](./ONBOARDING.md)** | **Guide nouveau dev : glossaire, état du projet, premier jour** |
| [BACKEND.md](../BACKEND.md) | Docker Compose, tests backend, patron sécurisé |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Git, commits MOA, statut hebdo |

## Architecture & plateforme

| Document | Contenu |
|----------|---------|
| [architecture.md](../architecture.md) | Topologie, modules, authN/authZ, déploiement |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | **CI/CD, ACR, Azure, limites runners GitHub, Jenkins ou non** |
| [architecture_complement.md](../architecture_complement.md) | Compléments architecture |
| [PLATFORM_APPS.md](../PLATFORM_APPS.md) | Les 16 apps métier |
| [PLATFORM_ROLES.md](../PLATFORM_ROLES.md) | Rôles, scopes, Cerbos |
| [planning.md](../planning.md) | Planning projet (PERT, nœuds A→N) |
| [backlog.md](../backlog.md) | Backlog stories |

## App 16 · Recueil des besoins *(module détachable, campagne 2027)*

| Document | Contenu |
|----------|---------|
| **[SPEC_RECUEIL_BESOINS_2027.md](./SPEC_RECUEIL_BESOINS_2027.md)** | **Spécification du module : détachabilité, référentiel éclaté par marque, modèle, emailing, jalons** |
| **[PATRON_IMPORT_TABULAIRE.md](./PATRON_IMPORT_TABULAIRE.md)** | **Patron transverse d'import Excel/CSV — story `00-9`** |
| **[AUDIT_ACADEMIX.md](./AUDIT_ACADEMIX.md)** | **Audit de l'existant remplacé : 26 fonctions, 10 failles, correspondance epics** |

## Frontend & UX

| Document | Contenu |
|----------|---------|
| **[rapport-conges-portail-dps-2026.md](./rapport-conges-portail-dps-2026.md)** | **Passation congés — travail portail DPS, MEDACAP, visible en démo** |
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | Tokens, composants, styles |
| **[PORTAL_COLORIMETRY.md](./PORTAL_COLORIMETRY.md)** | **Statuts portail (pastilles, bordures, PIF) — RAG / LMS / WCAG** |
| [APPRENANT_VIEWS.md](../APPRENANT_VIEWS.md) | Écrans portail apprenant |
| [PORTAL_PROFILES.md](../PORTAL_PROFILES.md) | Profils & données mock portail |

## Gouvernance dépôt

| Document | Contenu |
|----------|---------|
| [SECURITY.md](../SECURITY.md) | Divulgation vulnérabilités |
| [CHANGELOG.md](../CHANGELOG.md) | Historique des versions |
| **[RELEASE.md](./RELEASE.md)** | **Publication SemVer + GitHub Release automatique** |
| [LICENSE](../LICENSE) | Licence propriétaire interne |
| [.github/CODEOWNERS](../.github/CODEOWNERS) | Ownership par zone (à configurer) |

## Règles Cursor (équipe build)

Le contexte IDE pour l'app vitrine est dans [`.cursor/rules/cfaoacademy-project.mdc`](../.cursor/rules/cfaoacademy-project.mdc) : routes, données, pièges CSS connus.

## Conventions de nommage docs

- **MAJUSCULES** : référentiels stables (`PLATFORM_*.md`, `BACKEND.md`).
- **minuscules** : docs évolutives (`architecture.md`, `backlog.md`).
- Nouvelle ADR (décision d'architecture) : `docs/adr/NNNN-titre-court.md` (dossier à créer au besoin).

## Gouvernance GitHub (checklist admin)

À configurer sur l'organisation / repo `main` :

1. Vérifier que l'équipe `@cfao-academy/academy` existe et a accès au dépôt ([CODEOWNERS](../.github/CODEOWNERS)).
2. Branch protection : PR obligatoire, 1+ review, **Require review from Code Owners**, CI required.
3. Activer Dependabot alerts + secret scanning + push protection.
4. Créer les labels : `bug`, `enhancement`, `security`, `needs-triage`, `dependencies`, `frontend`, `backend`, `infra`, `ci`.
