# Nouveautés — Planning

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.3] - 2026-11-23

- Devis par filiale : une session issue d’une fiche besoins porte l'intitulé du module (catalogue de cfao-needs, contrat needs-analytics 1.7.0, sinon une session du classeur du même module) et un lieu clair : « Academy de Douala », le nom du pays de la filiale, ou « À distance » (au lieu de « Douala » et « Filiale »). Les sessions déjà en base sont mises à jour au prochain alignement, sans écriture si elles sont à jour.
- Devis par filiale : dates et formateurs du calendrier prévisionnel. La grille « Plannings formateurs » de l'année est relue au chargement automatique (import `forecast_grid`, table `GridBand`, migration 0016, idempotent, ne touche ni les sessions ni l'import `calendar_grid`). Une session sans date ou sans formateur les reprend de la grille (bande orange = filiale du pays, jaune = Academy de Douala, tous pays ; lignes « Formations reportées / annulées » ignorées), calculé à la lecture sans écriture, clé gelée comprise. Une date de session n'est jamais remplacée ; coûts et hébergements inchangés. Champs `dates_source` (« session » / « grid ») et `grid_slots` sur les lignes de la fiche pays ; l'écran affiche « Prévu » et « +N » autres créneaux du module.

## [0.2.2] - 2026-11-23

- Devis par filiale : les places attribuées sur les fiches besoins (case verte = filiale, bleue = Douala) que le classeur de la clé ne place pas encore en session deviennent des sessions « à dater » (lieu « Douala », « Filiale » ou « À distance »). Le devis les compte, les chiffre et les détaille ligne à ligne ; la carte « Devis des filiales » reprend le même total. Les places reportées (rouge) et sans couleur n'en font jamais partie.
- Sans double compte : les places d'un module déjà en session couvrent d'abord ses places à Douala, puis en filiale, puis à distance. Une clé gelée n'est pas touchée. L'import du classeur et la charge des formateurs ignorent ces sessions.
- Remplace le raccourci de la 0.2.1 : `attributed` et `total_attributed` sont retirés du tableau global, le total vient des sessions.
- Lit `assigned` du contrat needs-analytics 1.6.0.

## [0.2.1] - 2026-11-23

- Carte « Devis des filiales » : tant que la clé n'est pas gelée, les places attribuées comptent aussi celles des fiches besoins (cellule verte = filiale, bleue = Douala), pays par pays, sans additionner les places déjà en session. Les places reportées (rouge) et sans couleur ne comptent pas. Le tableau global porte `attributed` par pays et `total_attributed`.
