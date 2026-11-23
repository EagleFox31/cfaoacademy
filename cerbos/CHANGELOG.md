# Nouveautés — Droits d'accès (Cerbos)

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [0.3.1] - 2026-11-23

- Planning : le coordinateur, le directeur du centre et l'équipe technique (`superadmin`)
  voient le bilan de présence des stagiaires par année (chiffres agrégés, sans nom).

## [0.3.0] - 2026-11-19

- Écran de supervision réservé à l'équipe d'exploitation (`platform_ops`) et à l'équipe
  technique (`superadmin`).
- Planning : chaque formateur voit sa fiche et ses propres sessions.
- Un seul service de droits pour toute la plateforme : besoins, planning et supervision
  l'interrogent ; la clé de répartition s'affiche de nouveau sur l'accueil du centre.
