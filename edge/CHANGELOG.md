# Nouveautés — Edge

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

- Route `/api/v1/supervision/` vers le module de supervision (facultative : absente si
  `EDGE_SUPERVISION_UPSTREAM` est vide).
- Le journal d'accès note le compte et l'application de chaque appel (`sub`, `azp`) :
  la supervision affiche la dernière activité de chaque utilisateur.
