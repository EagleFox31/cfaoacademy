# Nouveautés — Identité (Keycloak)

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

- Rôle `platform_ops` (équipe d'exploitation) et accès du portail à l'API de supervision.
- Les connexions sont conservées 7 jours : la supervision affiche la dernière connexion
  de chaque utilisateur.
