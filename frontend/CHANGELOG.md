# Nouveautés — Portail

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.1] - 2026-11-22

- Super admin : « Voir le portail d'un compte réel » ouvre le portail d'un compte choisi, en lecture seule, avec ses données ; le bandeau dit « Aperçu en lecture seule en tant que … ».
- En aperçu, les écrans du centre de formation et de la clé de répartition n'offrent que la lecture : aucun droit de modification n'est prêté par le super admin.
- Coordinateur : deux chiffres de plus en haut du portail, les formations terminées et les stagiaires formés de l'année, tirés de la liste de présence (« liste de présence non chargée » quand elle manque).

## [0.2.0] - 2026-11-20

- Super admin : section « Voir les portails des profils », une carte par profil ; chaque portail s'ouvre dans une fenêtre à part, en aperçu lecture seule, avec ses propres droits.
- Les applications (comptes rendus, besoins, MEDACAP) peuvent être données par un chemin sur la même adresse que le portail (`/cr`, `/besoins`) en plus d'une adresse complète.
