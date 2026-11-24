# Nouveautés — Comptes rendus

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section. L'API et la passerelle partagent `CR_VERSION`.

## [Unreleased]

## [0.5.2] - 2026-11-20

- Connexion : après la connexion, la liste à documenter s'affiche toujours (plus de page blanche quand le portail ramène sur le module).

## [0.5.1] - 2026-11-20

- Connexion : l'écran ne reste plus blanc ; l'ouverture du module renvoie vers l'accueil formateur du portail, ou vers la liste à documenter si le portail est introuvable.
