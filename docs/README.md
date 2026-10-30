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
| [PLATFORM_APPS.md](../PLATFORM_APPS.md) | Les 15 apps métier |
| [PLATFORM_ROLES.md](../PLATFORM_ROLES.md) | Rôles, scopes, Cerbos |
| [planning.md](../planning.md) | Planning projet |
| [backlog.md](../backlog.md) | Backlog stories |

## Frontend & UX

| Document | Contenu |
|----------|---------|
| [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | Tokens, composants, styles |
| **[PORTAL_COLORIMETRY.md](./PORTAL_COLORIMETRY.md)** | **Statuts portail (pastilles, bordures, PIF) — RAG / LMS / WCAG** |
| [APPRENANT_VIEWS.md](../APPRENANT_VIEWS.md) | Écrans portail apprenant |
| **[MODULE_RAPPORTS_FORMATEUR.md](./MODULE_RAPPORTS_FORMATEUR.md)** | **Rapports post-formation (04-5) : parcours, modèle PowerPoint, service de rendu, tests** |
| [MISE_A_JOUR_PROD.md](./MISE_A_JOUR_PROD.md) | Mettre à jour le module des comptes rendus en production : sauvegarde, reconstruction, annonce aux utilisateurs, retour arrière |
| [etude-journal-erreurs.md](./etude-journal-erreurs.md) | Étude : journal des erreurs des comptes rendus consultable par l’équipe technique |
| [etude-polices-rendu.md](./etude-polices-rendu.md) | Étude : polices du PowerPoint, écarts de rendu Docker / Windows et options |
| [etude-photo-individuelle.md](./etude-photo-individuelle.md) | Étude : photo facultative du stagiaire sur sa fiche individuelle |
| [etude-fiche-anneau-jours.md](./etude-fiche-anneau-jours.md) | Étude : anneau seul et position de l’objet sur la fiche individuelle, jours ouvrés |
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
  - [0001 — Service de rendu des rapports formateur](./adr/0001-service-rapports-formateur.md)
  - [0002 — Module des comptes rendus détachable](./adr/0002-module-comptes-rendus-detachable.md)

## Gouvernance GitHub (checklist admin)

À configurer sur l'organisation / repo `main` :

1. Vérifier que l'équipe `@cfao-academy/academy` existe et a accès au dépôt ([CODEOWNERS](../.github/CODEOWNERS)).
2. Branch protection : PR obligatoire, 1+ review, **Require review from Code Owners**, CI required.
3. Activer Dependabot alerts + secret scanning + push protection.
4. Créer les labels : `bug`, `enhancement`, `security`, `needs-triage`, `dependencies`, `frontend`, `backend`, `infra`, `ci`.
