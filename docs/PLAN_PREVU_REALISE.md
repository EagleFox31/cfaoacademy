# Plan d'implémentation — prévu / réalisé (cfao-planning)

Conçu le 28/10/2026. Base : SPEC §8 « Prévu et réalisé » (clé = prévisionnel figé, grille = réalisé, refacturation sur le prévu).

## 1. Décision
- Le prévu est stocké à part, dans `PlannedSession` et `PlannedAllocation`, rattachés à `CostKeyYear`. `Session` et `SeatAllocation` ne contiennent que le réalisé. Conflits, calendrier, import Data et calcul réalisé ne voient donc jamais le prévu, sans filtre à ajouter.
- Le lien entre prévu et réalisé n'est pas stocké : il est **calculé** par groupe (année, marque, code_norm, pays hôte), sans date. Il est donc idempotent et rétroactif.
- Le gel combine deux mécanismes :
  - le statut `FROZEN` sur `CostKeyYear` rend le prévu immuable ;
  - un `CostKeySnapshot` (JSON du rapport, pris au gel) sert de base à la refacturation. Il est indispensable parce que le calcul dépend du référentiel, qui reste modifiable (`Trainer.kind`, `home_country`, alias, réglage Academy).

## 2. Modèles (`planning/models.py`)
1. `CostKeyYear` :
   - nouveaux champs `status` (DRAFT | FROZEN, DRAFT par défaut), `frozen_at`, `frozen_by` ;
   - quand la clé est FROZEN en base, `save()` lève `FrozenKeyError` si `budget`, `trainee_lodging_cost`, `trainer_lodging_cost` ou `hours_per_session` changent ;
   - `m2m_changed` sur `enrolled_countries` lève la même erreur quand la clé est FROZEN.
2. `PlannedSession(UUIDModel, TimeStampedModel)` :
   - `cost_key` FK PROTECT (related_name `planned_sessions`) ;
   - `brand` FK non nul ;
   - `code_norm`, `code_raw`, `title` ;
   - `start_date` et `end_date`, nullables ;
   - `location` ;
   - `country` = pays hôte. Ce nom est gardé pour que le duck typing de `is_academy_site` et `needs_trainer_lodging` fonctionne ;
   - `trainers` M2M, `trainers_raw`, `last_import` FK ImportLog ;
   - contrainte UniqueConstraint (cost_key, brand, code_norm, start_date, country), nommée `planned_session_identity` ;
   - CheckConstraint : end >= start si end est renseignée ;
   - le QuerySet/Manager redéfinit `update` et `delete`, qui lèvent l'erreur si la clé est FROZEN ; `save` et `delete` de l'instance aussi.
3. `PlannedAllocation` :
   - `planned_session` FK CASCADE, `country` FK PROTECT, `seats` > 0 ;
   - contrainte unique (planned_session, country) ;
   - mêmes gardes de gel, via `planned_session.cost_key`.
4. `CostKeySnapshot` :
   - `cost_key` OneToOne PROTECT ;
   - `report` en JSON, les Decimal sérialisés en str ;
   - `needs` en JSON ;
   - `inputs_sha256`, empreinte des lignes prévues triées et des paramètres ;
   - `engine_version`, alimenté par la constante `COST_KEY_ENGINE = 1` ;
   - `created_by`.
   - Il est immuable : `save` refuse la mise à jour et `delete` est refusé.
5. `ReviewItem.Reason` garde `NOT_IN_DATA` et `DATA_MISMATCH`, dont l'import B (grille) a besoin. Le docstring de `SeatAllocation` devient « places réalisées ».

## 3. Migrations
6. `planning/0003_planned_and_freeze` : champs de `CostKeyYear` et les 3 nouveaux modèles. Aucune autre app n'est touchée. Vérifier avec `makemigrations --check`.
7. `planning/0004_dismiss_seat_reviews` (RunPython, retour arrière no-op) :
   - passe en DISMISSED les ReviewItem OPEN dont `import_log.kind == "seat_allocations"` ;
   - renseigne `resolution={"superseded_by": "planned_import"}`.

## 4. Import des feuilles pays (`planning/imports/seat_sheets.py`)
8. Docstring : les lignes deviennent du prévisionnel, sans rattachement à `Session`.
9. `clean_row` :
   - reçoit le pays de la feuille ;
   - ne fait plus de requête `Session`.
   - Pays hôte :
     - lieu résolu → ce pays ;
     - lieu vide → pays de la feuille ;
     - lieu inconnu → refus `UNKNOWN_LOCATION`, avec une suggestion.
   - Formateurs : découpe avec `_TRAINER_SPLIT` (à importer de `data_sheet.py`), puis `resolver.trainer`. Un formateur inconnu est refusé (`UNKNOWN_TRAINER`), avec une suggestion.
   - Clé : `CostKeyYear(year=start.year, pole=brand.pole)`, mise en cache. Si elle est absente : `NO_COST_KEY`.
   - Le résultat contient `identity=(key_id, brand_id, code_norm, start, host_id)`, `end_date`, `title`, `trainer_ids` et `seats`. Il n'a plus de `session_id` ni de `review`.
10. `_parse_sheet` :
    - le doublon est détecté sur (identity, pays de la feuille), toujours sous le code `DUPLICATE_KEY` ;
    - une même identité présente sur plusieurs feuilles doit avoir les mêmes `end_date`, `location` et `trainer_ids`. Sinon : `PLANNED_CONFLICT`, en citant les deux feuilles.
11. Fin de `parse` :
    - regrouper par session prévue, avec `allocations={country_id: seats}` ;
    - puis `_check_frozen` : pour une clé FROZEN, si le contenu est identique au prévu en base, la clé est notée `noop` dans `extra`. S'il diffère, `fatal = "KEY_FROZEN"` et le diff (créés, modifiés, absents) va dans `extra`, donc l'import est REJECTED sans écriture.
12. `write` :
    - upsert de `PlannedSession` par identité, en ne mettant à jour que les champs modifiés, avec `last_import=log` ;
    - `trainers.set` et synchronisation des `PlannedAllocation` ;
    - les clés notées `noop` sont ignorées ;
    - `missing_from_file` ne porte que sur les clés touchées et les pays lus ;
    - `params.replace` sur une clé DRAFT supprime les absents ;
    - `report_extra` : `created`, `updated`, `planned_sessions`, `missing_from_file`, `frozen_noop`.
    - `_review` est supprimé.

## 5. Gel
13. `planning/services/cost_key_freeze.py`, fonction `freeze(key, actor, needs=None)` :
    - exécutée dans une transaction, avec `select_for_update` ;
    - refusée s'il n'y a aucune session prévue, ou si la somme des `key_cost` diffère du budget ;
    - enchaîne `compute(PLANNED)`, la création du snapshot, puis `status=FROZEN` ;
    - si la clé est déjà FROZEN avec le même sha, renvoie le snapshot existant (idempotent) ;
    - si le sha diffère, lève une erreur ;
    - pas d'`unfreeze` dans ce lot : il viendra plus tard, réservé au superadmin via Cerbos, avec motif tracé.
14. Commande `manage.py freeze_cost_key --year 2026 --pole MOTORS`.

## 6. Calcul (`planning/services/cost_key.py`)
15. `class Mode(StrEnum): PLANNED, ACTUAL` ; nouvelle signature `compute(key, needs=None, *, mode)`, avec un mode obligatoire.
16. `_units(key, mode)` renvoie (unit, trainers, allocations) :
    - ACTUAL : la requête actuelle ;
    - PLANNED : `key.planned_sessions`, avec prefetch, sans filtre de statut ;
    - la boucle de calcul ne change pas.
17. `CostKeyReport` reçoit un champ `mode` et les méthodes `to_dict()` / `from_dict()`.
18. `compare(key, needs=None) -> ComparisonReport` :
    - prévu : le snapshot si la clé est gelée, sinon `compute(PLANNED)` ;
    - réalisé : `compute(ACTUAL)` ;
    - une ligne par pays, sur l'union des pays : places, part, coût clé et total, en prévu et en réalisé ;
    - écarts `delta_seats`, `delta_key_cost`, `delta_total` (réalisé moins prévu) ;
    - plus le résumé des groupes du lien.

## 7. Lien prévu vers réalisé (`planning/services/plan_match.py`)
19. `match(key) -> list[MatchGroup]` :
    - groupes (brand_id, code_norm, pays hôte), limités à `key.year` et `brand__pole=key.pole` ;
    - p = nombre de sessions prévues, a = nombre de sessions réalisées actives (hors POSTPONED et CANCELLED) ;
    - statuts :
      - MATCHED si p = a ;
      - SHORTFALL si 0 < a < p ;
      - EXTRA si a > p > 0 ;
      - PLANNED_ONLY si a = 0 ;
      - ACTUAL_ONLY si p = 0 ;
    - aucun rapprochement flou : un code renommé se règle par un alias.

## 8. Docs
20. SPEC §8 :
    - réécrire « Import de reprise » : plus de rattachement par date, ni de NOT_IN_DATA, ni de DATA_MISMATCH ; le pays hôte se déduit du lieu ; ajouter PLANNED_CONFLICT, KEY_FROZEN et replace ;
    - ajouter un paragraphe « Gel et comparaison » ;
    - noter qu'un report de décembre à janvier donne PLANNED_ONLY.

## 9. Tests
- Tests existants :
  - `test_cost_key.py` : passer `mode=Mode.ACTUAL` aux 12 appels ;
  - `test_import_seat_sheets.py` : le fixture crée `CostKeyYear(2026, MOTORS)` et plus aucune Session ; les assertions sont réécrites vers PlannedSession / PlannedAllocation ; le test « aucune Session ni ReviewItem créé » remplace la revue.
- Import, nouveaux cas :
  - une session à Douala sur 3 feuilles donne 1 PlannedSession et 3 allocations ;
  - un lieu vide donne la feuille comme pays hôte ;
  - l'import Data ne touche pas au prévu.
- Import, cas négatifs :
  - UNKNOWN_LOCATION, UNKNOWN_TRAINER, NO_COST_KEY, MAROC sans date ;
  - PLANNED_CONFLICT ;
  - sur une clé gelée : des places modifiées donnent REJECTED KEY_FROZEN sans aucune écriture ; le même contenu avec d'autres octets donne APPLIED no-op ; le même sha renvoie le journal précédent ;
  - replace sur une clé DRAFT ou FROZEN.
- Gel (`test_cost_key_freeze.py`) :
  - le snapshot est égal à `compute(PLANNED)` ;
  - un double gel est idempotent ;
  - le gel d'une clé vide est refusé ;
  - négatifs : save, delete, QuerySet.update/delete, budget, `enrolled_countries.add` → `FrozenKeyError` ;
  - le snapshot est immuable ;
  - un changement de `home_country` après le gel laisse le snapshot et le prévu inchangés.
- Lien (`test_plan_match.py`) :
  - 1 vers 1 avec une date décalée donne MATCHED ;
  - 1 vers 2 donne EXTRA ; 2 vers 1 donne SHORTFALL ;
  - une session annulée donne PLANNED_ONLY ; une session ajoutée, ACTUAL_ONLY ;
  - négatifs : autre hôte, autre année, autre pôle, code proche (TS03 contre TS03-G3).
- Comparaison :
  - écart par pays ;
  - somme des coûts clés égale au budget dans chacun des deux modes ;
  - un pays non enrôlé avec des places reste sans part.

## 10. Risques
- **Le réalisé par pays n'a plus de source** : plus rien n'écrit `SeatAllocation`. Une décision métier est attendue (voir PASSATION).
- **Lieu vide** : le classeur ne compte un hébergement formateur que si le lieu est renseigné. Le vérifier au dry-run, au franc près. Si l'écart se confirme, mettre `needs_trainer_lodging` à faux en mode PLANNED quand le lieu est vide.
- **Résolution stricte des formateurs, PLANNED_CONFLICT sur les copies Module2** : faire un dry-run V27 avant de livrer, puis ajouter des alias.
- **Les gardes de gel sont applicatives** : le SQL brut et `bulk_create` les contournent. Le snapshot reste la garantie.
