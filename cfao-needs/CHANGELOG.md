# Nouveautés — Recueil des besoins

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section. L'API et la passerelle ont des numéros distincts : préfixer
chaque puce par « API : » ou « Passerelle : ».

## [Unreleased]
