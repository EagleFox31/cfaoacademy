# Nouveautés — Edge

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.4.2] - 2026-11-24

- Écoute du portail : l'API des besoins (`/api/v1/needs/`) y est servie, les cartes du
  portail lisent les campagnes sur leur propre adresse. Rien d'autre ne change.

## [0.4.0] - 2026-11-20

- Route `/api/v1/supervision/` vers le module de supervision (facultative : absente si
  `EDGE_SUPERVISION_UPSTREAM` est vide).
- Le journal d'accès note le compte et l'application de chaque appel (`sub`, `azp`) :
  la supervision affiche la dernière activité de chaque utilisateur.
- Les écoutes LAN (comptes rendus, portail) suivent le schéma et le port déclarés par le proxy HTTPS placé devant (Caddy sur l'IP du serveur).
- Écoute LAN du portail par rôle (`EDGE_PORTAIL_UPSTREAM`, facultative).
