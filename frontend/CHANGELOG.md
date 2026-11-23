# Nouveautés — Portail

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.4] - 2026-11-23

- Super admin : une carte « Voir les portails des profils » ouvre le portail d'un compte réel de ce profil (le premier par nom), en lecture seule, avec ses données. Sans compte de ce profil, l'aperçu s'ouvre avec les droits du super admin et le message le dit.

- Directeur du centre : une carte « Voir les portails des profils », en construction, dans la section des outils numériques.
- Super admin : dans les profils opérationnels, la carte « Formateur & Directeur Centre » devient deux cartes, « Formateur » et « Directeur du centre de formation ».

## [0.2.3] - 2026-11-23

- Coordinateur : les chiffres « devis des filiales » et « formateurs avec deux sessions trop rapprochées » quittent le haut du portail.
- Super admin : un clic sur une carte « Voir les portails des profils » affiche toujours un message : fenêtre ouverte (peut-être derrière), ou bloquée par le navigateur avec un lien pour l'ouvrir dans un onglet.
- Super admin : la carte du DOP le présente sur sa filiale, comme le DPS, et non plus sur une zone régionale.

## [0.2.2] - 2026-11-23

- Super admin connecté par la connexion d'entreprise : son portail s'affiche enfin (en-tête, phrase chiffrée, cartes). Il était vide, seul le fond apparaissait. Sans réponse de l'API, les chiffres restent « — », jamais ceux de la démonstration.

## [0.2.1] - 2026-11-22

- Super admin : « Voir le portail d'un compte réel » ouvre le portail d'un compte choisi, en lecture seule, avec ses données ; le bandeau dit « Aperçu en lecture seule en tant que … ».
- En aperçu, les écrans du centre de formation et de la clé de répartition n'offrent que la lecture : aucun droit de modification n'est prêté par le super admin.
- Coordinateur : deux chiffres de plus en haut du portail, les formations terminées et les stagiaires formés de l'année, tirés de la liste de présence (« liste de présence non chargée » quand elle manque).

## [0.2.0] - 2026-11-20

- Super admin : section « Voir les portails des profils », une carte par profil ; chaque portail s'ouvre dans une fenêtre à part, en aperçu lecture seule, avec ses propres droits.
- Les applications (comptes rendus, besoins, MEDACAP) peuvent être données par un chemin sur la même adresse que le portail (`/cr`, `/besoins`) en plus d'une adresse complète.
