# Nouveautés — Identité (Keycloak)

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.6.0] - 2026-11-20

- Page de connexion laissée ouverte : elle se relance d'elle-même avant l'expiration de la
  tentative de connexion (30 min), sans message « délai expiré » ni clic ; l'identifiant saisi
  est gardé, jamais le mot de passe.
- Mot de passe : 12 caractères au moins, avec une majuscule, un chiffre et un caractère
  spécial ; une jauge de force s'affiche sur l'écran de nouveau mot de passe.
- Sécurité : les jetons du portail ne visent plus que core, planning et supervision
  (comptes rendus et opérations retirés).
- Sécurité : le client de développement `cfao-spa` n'accepte plus le mot de passe en direct
  (code + PKCE seulement) et n'accepte que des adresses de retour exactes
  (`CFAO_SPA_REDIRECT_URIS`).
- Besoins : adresse de retour `/besoins/` de la recette ajoutée par défaut.

## [0.5.4] - 2026-11-19

- Rôle `platform_ops` (équipe d'exploitation) et accès du portail à l'API de supervision.
- Les connexions sont conservées 7 jours : la supervision affiche la dernière connexion
  de chaque utilisateur.
