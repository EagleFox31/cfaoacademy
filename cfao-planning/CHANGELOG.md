# Nouveautés — Planning

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section.

## [Unreleased]

## [0.2.5] - 2026-11-24

- Calendrier annuel de formation : `GET years/<année>/calendar/<pôle>` renvoie la grille « Plannings formateurs » (lignes, bandes avec type, dates, nom complet du formateur, filiale et marque résolues, jours fériés de la grille). Droit Cerbos `planning_calendar` (directeur et coordinateur du centre, assistante, superadmin) ; `/access` renvoie `calendar`.
- Import de la grille : le type de chaque bande (Douala, filiale, formateurs, client, support, congés) et les jours fériés (colonne violette) sont lus.
- Charge des formateurs : des formations enchaînées sans jour ouvré entre elles comptent pour une seule ; les deux semaines de pause se comptent après la fin de la dernière.
- Points à traiter du devis : une place attribuée sans date de session ni créneau dans la grille est signalée au coordinateur (« sans date »).

## [0.2.4] - 2026-11-23

- Calendrier prévisionnel : une session à cheval sur deux mois (du 28/06 au 02/07) ne fait plus deux créneaux. La grille la dessine en deux bandes, une par colonne de mois ; elles sont recollées, formateurs réunis.
- Import de la grille : un libellé de mois mal écrit (« JIULLET ») est reconnu ; avant, tout le bloc prenait le mois précédent. La suite d'une session au 1er du mois, vide ou réduite au code (« H11 »), reprend le texte de la bande qui finit la veille sur la même ligne du formateur. Grille 2027 : 220 → 223 bandes, juillet EQUIPMENT redaté.

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
