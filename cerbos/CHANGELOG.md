# Nouveautés — Droits d'accès (Cerbos)

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

- Écran de supervision réservé à l'équipe d'exploitation (`platform_ops`) et à l'équipe
  technique (`superadmin`).
