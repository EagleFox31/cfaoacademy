# Nouveautés — Edge

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.4.1] - 2026-11-22

- « Vu comme » en lecture seule : toute requête qui porte l'en-tête `X-Cfao-Vu-Comme` et
  n'est ni GET ni HEAD reçoit un 403 JSON (`{"detail":"lecture seule"}`), sur l'adresse
  publique et sur chaque écoute LAN, pour tous les modules. Rien d'autre ne change.

## [0.4.0] - 2026-11-20

- Route `/api/v1/supervision/` vers le module de supervision (facultative : absente si
  `EDGE_SUPERVISION_UPSTREAM` est vide).
- Le journal d'accès note le compte et l'application de chaque appel (`sub`, `azp`) :
  la supervision affiche la dernière activité de chaque utilisateur.
- Les écoutes LAN (comptes rendus, portail) suivent le schéma et le port déclarés par le proxy HTTPS placé devant (Caddy sur l'IP du serveur).
- Écoute LAN du portail par rôle (`EDGE_PORTAIL_UPSTREAM`, facultative).
