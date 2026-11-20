# Nouveautés — Socle (core)

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

- Production : réglages dédiés (`config.settings.prod`) — débogage coupé, clé secrète et hôtes obligatoires (`*` refusé au démarrage), aucune clé par défaut.
- Rôle `platform_ops` (équipe d'exploitation) reconnu par le socle.
