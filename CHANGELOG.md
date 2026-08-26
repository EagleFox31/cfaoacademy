# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- **App 16 · Recueil des besoins de formation** — module détachable (`cfao-needs`), campagne exercice 2027 : spécification `docs/SPEC_RECUEIL_BESOINS_2027.md`, stories `backlog.md` §16, matrice d'accès `PLATFORM_APPS.md` §16, nœud PERT **N** (N₀/N₁/N₂, 3,5 sem.-personne, hors chemin critique).
- **Circuit d'envoi à validation** (app 16) : aucun email vers une filiale sans relecture de l'équipe Academy — résumé interne + lien, validation en plateforme, confirmation à l'auteur avec ses destinataires en copie. File « À envoyer », prévisualisation, approbation par lot.
- **Familles de catalogue** avec statut `READY` / `PENDING` : la campagne s'ouvre sans attendre les catalogues manquants (dont Yamaha), chaque famille se branche par import.
- **`cfao-needs/`** — R0 du module détachable : socle Django (auth OIDC, PEP Cerbos, patron d'import), modèle de données complet, circuit d'envoi à validation, policies `needs_*` avec tests négatifs, `docker-compose.yml` 7 services, realm Keycloak en config-as-code, passerelle nginx. 20 tests Python verts.
- Story `16-25` : remplacer `OMODA & JAECCO` par **`OMODA & JAECOO`** (orthographe de référence) dans les 15 fichiers du dépôt portant encore la graphie fautive.
- **Patron d'import tabulaire** (`docs/PATRON_IMPORT_TABULAIRE.md`) — story transverse `00-9`, appliquée à `00-2`, `00-4`, `00-5`, `08-2`, `16-4`, `16-9`.
- **Audit Academix** (`docs/AUDIT_ACADEMIX.md`) — 26 fonctions de l'existant remplacé, 10 failles, correspondance avec les epics.
- Stories issues de l'audit : `05-5` calendrier matriciel annuel, `08-7`/`08-8` logistique et coût par stagiaire, `14-12` à `14-16` (journal d'envoi, machine de relance, groupage par inactivité, langue portée par la personne, templates versionnés).
- Événement inter-services `needs_consolidated` (app 16 → module `sessions`), contrat figé.
- Fichiers de gouvernance dépôt : README, SECURITY, CHANGELOG, CODEOWNERS, templates GitHub, Dependabot.
- Job CI `frontend` (build Vite) et exécution des tests Vitest `cfao-operations`.

### Changed
- `architecture.md` §3 : 16 apps réparties sur **2 services + 1 module détachable** (`cfao-needs`).
- Référentiel marques : **Stellantis éclaté** en CITROEN, FIAT, JEEP, PEUGEOT — nouveauté pour le site aussi (`catalogues/training-catalog.json`, `catalogues/stellantis/`), story `16-24`.

## [0.1.0] - 2026-06-09

### Added
- Socle plateforme : Keycloak, Cerbos, `cfao-core` (Django), `cfao-operations` (Node), gateway nginx, Docker Compose.
- Frontend vitrine + portail : React 19, Vite, routes publiques et espace connecté (mock).
- Policies Cerbos avec tests négatifs ; CI (Cerbos, pytest, build Node, Gitleaks).
- Documentation architecture, apps plateforme, rôles, design system, guide de contribution MOA.

[Unreleased]: https://github.com/EagleFox31/cfaoacademy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/EagleFox31/cfaoacademy/releases/tag/v0.1.0
