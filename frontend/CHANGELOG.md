# Nouveautés — Portail

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.5] - 2026-11-23

- Directeur du centre, rubrique Plateforme : la carte « Voir les portails des profils », seule ouverte, passe en première position et en vert ; le jaune orangé reste réservé aux fonctionnalités en construction.
- Devis par filiale : colonne Lieu avec le drapeau du pays (« Academy de Douala », pays de la filiale ou « À distance ») ; dates et formateurs repris du calendrier prévisionnel quand la session n'en a pas, avec la mention « Prévu » et les autres créneaux au survol (« +N »), date modifiable par le coordinateur.
- Devis, filtre Mois : sélecteur de mois (grille des 12 mois de l'année, sans les jours ni l'année), chaque mois avec son nombre de sessions ; un mois vide reste visible, grisé.
- Directeur du centre, page « Portails des profils » : 19 profils (directeur du centre et Expert Technique ajoutés), colonnes « Son périmètre » et « Ce qu'il voit de MEDACAP » (7 lettres, un clic sur une lettre allumée liste les fonctionnalités), un « ? » donne la description de chaque profil, l'apprenant est nommé « Apprenant ou Technicien ». « Voir son portail » ouvre, en lecture seule, le portail du coordinateur et celui de l'assistante. Dans un aperçu, la salutation ne nomme plus celui qui regarde.
- Nouveau profil « Expert Technique » : même portail que le Key Instructor (Toyota) et le PIC (Suzuki), pour les marques d'engins, de bus, de chariots et de camions.
- Directeur du centre : la carte « Voir les portails des profils » s'ouvre sur une page au format des détails du DPS, navbar conservée. Elle liste les 17 profils en 4 groupes (centre de formation, groupe, filiales, apprenants) avec ce que chacun voit et le nombre de comptes de chaque profil (« — » tant que le serveur ne répond pas). « Voir son portail » est annoncé, pas encore actif.

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
