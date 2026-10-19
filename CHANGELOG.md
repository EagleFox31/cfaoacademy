# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- Fichiers de gouvernance dépôt : README, SECURITY, CHANGELOG, CODEOWNERS, templates GitHub, Dependabot.
- Job CI `frontend` (build Vite) et exécution des tests Vitest `cfao-operations`.
- Espace formateur (04-5) : assistant de rapport post-formation et de certification pratique — saisie des notes et des avis, import / export Excel, aperçu réel de chaque page, rapport PowerPoint / PDF conforme au modèle CFAO, suivi des rapports en cours et terminés.
- Service `rapports` (rendu LibreOffice) dans Docker Compose et la passerelle ; tests Vitest du frontend et pytest des services en CI.
- Module des comptes rendus détachable (04-5) : interface autonome dans `cfao-comptes-rendus/web`, passerelle nginx, base PostgreSQL et port dédié (8090) ; démarrage seul par `docker compose up`, modes `local` (comptes à mot de passe) et `standalone` ; le portail renvoie les anciennes adresses vers le module (`VITE_CR_URL`). Voir l'ADR 0002.
- Module des comptes rendus (04-5) : connexion, barre de navigation, accueil et cartes repris à l'identique du portail CFAO Academy (feuilles de style et composants copiés dans `web/src/styles/portail` et `web/src/components/portail`, fond selon le métier du formateur).

## [0.1.0] - 2026-06-09

### Added
- Socle plateforme : Keycloak, Cerbos, `cfao-core` (Django), `cfao-operations` (Node), gateway nginx, Docker Compose.
- Frontend vitrine + portail : React 19, Vite, routes publiques et espace connecté (mock).
- Policies Cerbos avec tests négatifs ; CI (Cerbos, pytest, build Node, Gitleaks).
- Documentation architecture, apps plateforme, rôles, design system, guide de contribution MOA.

[Unreleased]: https://github.com/EagleFox31/cfaoacademy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/EagleFox31/cfaoacademy/releases/tag/v0.1.0
