# Nouveautés — Recueil des besoins

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section. L'API et la passerelle ont des numéros distincts : préfixer
chaque puce par « API : » ou « Passerelle : ».

## [Unreleased]

- Production : réglages dédiés (`config.settings.prod`) — débogage coupé, hôtes servis listés dans `NEEDS_ALLOWED_HOSTS` (obligatoire, `*` refusé au démarrage). Un en-tête Host inconnu reçoit 400.

## [0.4.0] - 2026-11-20

- Passerelle : l'application s'ouvre désormais à l'adresse `/besoins/`, comme les autres applications CFAO Academy. Les anciens liens à la racine redirigent vers `/besoins/`.
- Passerelle : la page d'accueil n'est plus gardée en cache par le navigateur ; une nouvelle version s'affiche sans vider le cache.
