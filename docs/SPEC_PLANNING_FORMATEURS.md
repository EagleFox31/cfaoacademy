# Module Planning des formateurs (`cfao-planning`)

Module détachable d'Academix (CFAO Academy). Il remplace le classeur
« Plannings formateurs 2026 » : import du fichier existant, puis consultation et
édition du planning par formateur, par mois et par service.

## 1. Périmètre

- Dans le périmètre : sessions de formation, affectation des formateurs, absences
  (congés, récupération, jours fériés), conflits de disponibilité, import Excel,
  export Excel, vue mensuelle façon classeur.
- Hors périmètre (v1) : réservation de salles, logistique de voyage, inscriptions
  des stagiaires (elles relèvent du LMS / MEDACAP).

## 2. Fichier source analysé

| Feuille | Contenu | Rôle dans l'import |
|---|---|---|
| `Data` (masquée) | Tableau plat : 1 ligne = 1 session (marque, type, code, réf., module, pays hôte, lieu, début, fin, formateur, jours, heures, places, heures totales) | **Import A**, source maîtresse |
| `Calendrier-Motors`, `Calendrier-Equipment` | Grille : un bloc par mois (en-tête Mois / Marques / Formateurs / 1..31), 2 lignes par formateur (code + lieu, puis intitulé), cellules fusionnées sur la durée, couleur de fond = nature / statut | **Import B**, contrôle et compléments |
| `Menu déroulant` (masquée) | Listes de valeurs : animateurs, marques, services, actions (NON EFFECTUÉ, RÉALISÉ, REPORTÉ, ANNULÉ, EN COURS) | Graine du référentiel |

Irrégularités constatées, à absorber par le référentiel d'alias et non par du
rapprochement flou : noms de formateurs écrits de plusieurs façons, codes
« TS03-G3 » / « TS03 - G3 », pays en code maison (CFR, RCI), absences en texte
libre (« conges », « Congés », « Récup », « Jour férié »), couleurs de thème.

## 3. Modèle

- Référentiel : `Brand` (+ alias), `Country` (+ alias, `org_path` pour Cerbos),
  `Trainer` (+ alias, service, marques, compte Keycloak), `Holiday`, `ColorRule`
  (couleur de fond vers statut / catégorie), `AbsenceKeyword`, `UserProfile`.
- Planning : `Session`, `SessionAssignment` (LEAD / CO), `Absence`, `ReviewItem`.
- Clé d'idempotence d'une session : année + marque + code normalisé + date de
  début + pays. Un même module revient plusieurs fois dans l'année.
- Statuts : DRAFT, PLANNED, IN_PROGRESS, DONE, POSTPONED, CANCELLED. Couleurs des
  pastilles selon AGENTS.md (done vert, progress ambre, open bleu, cancelled noir).

## 4. Règles d'import

Patron commun : docs/PATRON_IMPORT_TABULAIRE.md (synonymes d'en-têtes, modèle
vierge, rapport ligne à ligne persistant, tout ou rien, prévisualisation).

- **Import A (Data)** crée et met à jour les sessions. Formateurs multiples
  séparés par `/ & + ,` : le premier est LEAD. Valeur inconnue du référentiel :
  ligne refusée avec suggestion. Une session absente du nouveau fichier n'est
  jamais supprimée : elle est listée (`missing_from_file`). Un fichier identique
  (même empreinte sha256) déjà appliqué ne réécrit rien.
- **Import B (grille)** n'écrit que : absences, statuts déduits de la couleur,
  et éléments de revue (`ReviewItem`) pour tout ce qui n'est pas tranché (couleur
  sans règle, texte non reconnu, bloc absent de Data, écart avec Data). Il ne
  crée jamais de session sans validation humaine. Un réimport ne duplique aucun
  élément de revue (empreinte unique).

## 5. Conflits

- Bloquants (HTTP 409, contournables avec un motif tracé) : formateur déjà
  affecté sur une période qui se chevauche, formateur absent.
- Avertissements : jour férié du pays hôte, enchaînement de deux pays sans
  battement, session sans formateur à moins de 30 jours.

## 6. API (`/api/v1/planning/`)

`imports/{kind}/template`, `imports/{kind}/preview`, `imports/{kind}`,
`imports/`, `imports/{id}`, `sessions/` (CRUD, champ `version`, 409 si conflit
de version), `sessions/{id}/start|complete|postpone|cancel`, `calendar`,
`calendar/trainers/{id}`, `absences/`, `conflicts`, `review-items/`,
`referential/*`, `me`.

## 7. Autorisations (Cerbos, refus par défaut)

- `planning_manager` (assistante centre, directeur centre, coordinateur, superadmin) :
  tout.
- `own_trainer` : un formateur lit son planning et le détail de ses absences.
- `planning_scoped_reader` (chef d'atelier, admin filiale) : lecture des
  sessions de son périmètre (`scopeNodes` dans `orgPath`), sans le motif des
  absences.
- Chaque règle a ses tests positifs et négatifs.

## 8. Répartition des places et clé de répartition des coûts

Source analysée : `docs/cle-repartition/Clé de Répartition + Formation 2026 par
pays + formation par marque.xlsm` (v4 et v5 sont des versions antérieures). Elle
fait partie du processus : besoins (cfao-needs), puis planning, puis répartition.

- **Classeur actuel** :
  - Feuilles par marque : places par module et par pays. La couleur indique le
    lieu, vert = filiale et bleu = Cameroun, avec des macros VBA.
  - MOTORS GLOBAL : besoins, techniciens et places réelles par pays et par
    marque, plus le taux de couverture.
  - Feuilles par pays : sessions, places attribuées et coût total.
  - Liste des thématiques non choisies.
- **Modèle cible** :
  - `SeatAllocation` (session, pays, places), qui remplace la couleur et les
    macros.
  - `CostKeyYear` (année, pôle, budget, coût d'hébergement technicien et
    formateur, heures par session = 40, pays enrôlés).
  - Pays enrôlés : certains pays entrent dans la clé une année donnée, la clé ne
    les rétroagit pas.
  - Le lieu se déduit de la session (Douala ou filiale), et non d'une couleur :
    une session est à l'Academy si son lieu nomme le site (`PLANNING_ACADEMY_SITE`)
    ou, sans lieu, si elle se tient dans le pays de l'Academy.
  - Un technicien instructeur est un technicien d'un certain niveau habilité à
    animer des formations de son niveau ; ce n'est pas un formateur. Le nom
    dépend de la marque : PIC chez Suzuki, Key Instructor chez Toyota. Il figure
    au référentiel comme animateur de type `TECH_INSTRUCTOR` (`Trainer.kind`),
    rattaché à sa marque, et n'ouvre pas d'hébergement formateur.
  - Un formateur est basé à l'Academy, sauf si `Trainer.home_country` indique
    une filiale : il ne se loge qu'en dehors de ce pays (ex. Coulibaly BOMBA,
    basé en RCI, n'ouvre pas d'hébergement pour les sessions RCI).
  - Les techniciens du pays de l'Academy (Cameroun) sont chez eux : leurs places
    à Douala n'ouvrent pas d'hébergement technicien.
  - Sessions annulées ou reportées exclues ; parts arrondies au franc par la
    méthode des plus forts restes (la somme vaut exactement le budget).
- **Calculs** :
  - `Part du pays = Places réelles du pays / Total des places réelles` (pays
    enrôlés seulement).
  - `Coût clé du pays = Budget du pôle x Part du pays`.
  - `Hébergement techniciens = Places du pays sur des sessions à Douala x Coût
    d'hébergement`.
  - `Hébergement formateurs = Sessions du pays hors Douala, formateur non PIC, x
    Coût d'hébergement`.
  - `Coût total = Coût clé + Hébergement techniciens + Hébergement formateurs`.
  - `Coût horaire stagiaire = Budget / (Places x Heures par session)`.
  - `Taux de couverture = Places réelles / Besoins`, les besoins étant lus
    depuis cfao-needs par contrat et non ressaisis.
- **Sorties** :
  - Tableau global pays × marque (besoins, techniciens, réel, couverture, part, coût).
  - Fiche par pays, exportable en xlsx, qui remplace les feuilles par pays.
  - Thématiques non choisies, c'est-à-dire les modules du catalogue sans
    aucune demande : une marque peu demandée reste visible.
- **Prévu et réalisé (décision métier du 28/10/2026)** :
  - La clé est établie avant l'année : offre envoyée aux filiales, réponses,
    réunions de placement. Le calendrier évolue ensuite selon le business des
    filiales, la disponibilité des formateurs et des techniciens, et les
    politiques.
  - Les feuilles pays de la clé sont donc le **prévisionnel**. Leurs sessions et
    leurs places sont importées telles quelles, puis figées pour l'année.
  - La grille du planning est le **réalisé**. Une session réalisée se relie à sa
    session prévue par marque, code et pays, jamais par date, car un report
    garde le lien.
  - Une session ajoutée en cours d'année n'a pas de session prévue. Une session
    prévue absente du réalisé est annulée ou reportée.
  - **La refacturation suit la clé prévue.** La clé actualisée (places réelles)
    est calculée et affichée en comparaison. Elle préparera la clé de l'année
    suivante.
- **Import du prévisionnel** : import des feuilles pays du classeur (marque,
  code, dates, formateur, lieu, places) vers `PlannedSession` et
  `PlannedAllocation`, jamais vers `Session` : conflits, calendrier et réalisé ne
  voient pas le prévu.
  - Commande : import `seat_allocations` (`planning/imports/seat_sheets.py`).
    Chaque feuille dont le nom résout un pays est lue, les autres sont listées
    comme ignorées.
  - Identité d'une session prévue : clé de l'année (année de début, pôle de la
    marque), marque, code, date de début, pays hôte. Le pays hôte est celui du
    lieu ; lieu vide, celui de la feuille.
  - Refus à la ligne : `UNKNOWN_LOCATION` (lieu sans pays), `UNKNOWN_TRAINER`,
    `NO_COST_KEY` (pas de clé pour l'année et le pôle), date absente, fin avant
    début. Chaque refus porte une suggestion quand le référentiel en a une.
  - Une feuille est refusée si son total ne correspond pas au pied « TOTAL » ou
    si la même session y figure deux fois pour un pays.
  - La même session revient sur la feuille de chaque pays qui y a des places :
    fin, lieu et formateurs doivent concorder, sinon `PLANNED_CONFLICT` cite les
    deux feuilles.
  - Les absents du fichier (clés touchées, pays lus) sont listés ; avec
    `replace`, ils sont supprimés sur une clé en préparation.
- **Gel et comparaison** :
  - `manage.py freeze_cost_key --year 2026 --pole MOTORS` (service
    `cost_key_freeze.freeze`) gèle la clé : statut `FROZEN`, prévu et paramètres
    immuables, snapshot du rapport pris au même instant. Refusé sans session
    prévue ou si le budget n'est pas réparti au franc. Idempotent.
  - Le snapshot est la base de la refacturation : le calcul dépend du référentiel
    (type de formateur, pays d'attache, alias, site de l'Academy), qui reste
    modifiable.
  - Sur une clé gelée, un import au contenu identique est un no-op ; tout écart
    rejette l'import (`KEY_FROZEN`) sans écriture, avec le diff (créées,
    modifiées, absentes). Pas de dégel dans ce lot.
  - `compute(mode=PLANNED | ACTUAL)` ; `compare` donne par pays places, part,
    coût clé et total en prévu et en réalisé, et l'écart (réalisé moins prévu).
  - Lien prévu → réalisé (`services/plan_match.py`), calculé et jamais stocké,
    par groupe marque, code, pays hôte sur l'année et le pôle : `MATCHED`,
    `SHORTFALL`, `EXTRA`, `PLANNED_ONLY`, `ACTUAL_ONLY`. Une session reportée de
    décembre à janvier sort de l'année : `PLANNED_ONLY`.
  - Le VBA du classeur (Module1 et Module2) ne calcule pas la clé. Module1 somme
    des cellules selon leur couleur. Module2 remplit « Formations au Cameroun »
    avec les places des filiales sur les sessions de Douala (code, formateur et
    lieu).
  - Les hébergements sont des formules de pied de feuille :
    - techniciens : `SUMIF(Lieu = "Douala", Places) x 1 800 000` ;
    - formateurs : `nombre de lignes hors Douala, lieu non vide et formateur non
      PIC, x 1 800 000`, donc un compte par session et non par formateur.
  - Formules fausses relevées dans le classeur 2026, que le calcul ne reproduit
    pas :
    - GUINÉE ÉQUATORIALE : x 18 000 000 au lieu de 1 800 000 (54 M au lieu de
      5,4 M) ;
    - CONGO : SUMIF à partir de G8 au lieu de G2, donc 36 places au lieu de 56.
  - Amorçage de la clé : `manage.py seed_cost_key` (2026 MOTORS : budget
    300 000 000, hébergements 1 800 000, 24 pays enrôlés), après
    `seed_referential`.
- **Anomalies à remonter** :
  - le budget de MOTORS GLOBAL est libellé « BUDGET EQUIPMENT 2025 » ;
  - une date de fin vaut « 17/07/22610 » (RCI, MSTEP02) ;
  - un lien vers un classeur externe `[1]Planifications`.

## 9. Écart RAIDER assumé

Le socle `core/` est copié depuis cfao-needs (principe R, réutilisable) pour que
le module reste déployable seul. La factorisation dans un paquet partagé est
reportée ; toute correction de sécurité du socle doit être reportée dans les deux
modules.
