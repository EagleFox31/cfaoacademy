# Nouveautés — Planning

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.1] - 2026-11-23

- Carte « Devis des filiales » : tant que la clé n'est pas gelée, les places attribuées comptent aussi celles des fiches besoins (cellule verte = filiale, bleue = Douala), pays par pays, sans additionner les places déjà en session. Les places reportées (rouge) et sans couleur ne comptent pas. Le tableau global porte `attributed` par pays et `total_attributed`.
