# Nouveautés — Portail

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

- Les applications (comptes rendus, besoins, MEDACAP) peuvent être données par un chemin sur la même adresse que le portail (`/cr`, `/besoins`) en plus d'une adresse complète.
