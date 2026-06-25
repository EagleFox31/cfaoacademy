# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- Fichiers de gouvernance dépôt : README, SECURITY, CHANGELOG, CODEOWNERS, templates GitHub, Dependabot.
- Job CI `frontend` (build Vite) et exécution des tests Vitest `cfao-operations`.

## [0.1.0] - 2026-06-09

### Added
- Socle plateforme : Keycloak, Cerbos, `cfao-core` (Django), `cfao-operations` (Node), gateway nginx, Docker Compose.
- Frontend vitrine + portail : React 19, Vite, routes publiques et espace connecté (mock).
- Policies Cerbos avec tests négatifs ; CI (Cerbos, pytest, build Node, Gitleaks).
- Documentation architecture, apps plateforme, rôles, design system, guide de contribution MOA.

[Unreleased]: https://github.com/cfao-academy/cfaoacademy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cfao-academy/cfaoacademy/releases/tag/v0.1.0
