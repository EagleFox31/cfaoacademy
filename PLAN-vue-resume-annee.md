# Plan : résumé annuel du directeur lu depuis une vue (session cfao-planning, 18/11)

Plan de l'agent architecte, à implémenter (skill mission). Fichier de travail, hors commit.

> **AMENDEMENT DE L'UTILISATEUR (18/11) : aucun calcul à l'affichage.** Une vue SQL simple ne convient donc pas, car elle recalcule à chaque lecture. Ce qui remplace les vues ci-dessous :
> - **Table `planning_year_summary`** : une ligne par année, avec answered, known, needs, seats, status, le détail par pôle en JSON et `computed_at`. L'endpoint `/years/summary` ne fait que lire ces lignes. `academy_countries` est lu ou stocké de la même façon.
> - **Remplie à l'écriture, avec le calcul existant** : `consolidate([global_table(...)])` en mode PLANNED, puis la logique de `syntheseAnnee`. Les chiffres sont donc identiques par construction : pas de SQL dupliqué, pas de table `planning_needsline`, pas de modèles non gérés.
> - **Recalcul de l'année touchée seulement**, via `transaction.on_commit` (dédoublonné par année). Il est déclenché par :
>   - `apply_snapshot` ;
>   - les imports et la préparation de l'année (`bootstrap` / `update`) ;
>   - PlannedSession et PlannedAllocation (signaux) ;
>   - CostKeyYear, avec son statut et le gel (signaux) ;
>   - les pays enrôlés (`m2m_changed`, déjà branché ~l.490) ;
>   - le snapshot de la clé ;
>   - Country, CountryAlias, Brand et BrandAlias (recalcul de toutes les années).
> - **Écritures en masse** (`bulk_create`, `update()`, ce qui inclut les imports) : appeler `refresh_year_summary(year)` à la main. Faire un grep exhaustif de ces écritures dans `planning/services` et `planning/imports`.
> - **Rétroactif (§7)** : `sync_needs_snapshot` ou le job migrate appelle `ensure_year_summaries()`, qui calcule les années absentes ou périmées (version de copie, `updated_at` max) et n'écrit rien si tout est à jour.
> - Le visible par lecteur reste un filtre : le directeur voit tous les pays. Pour un lecteur restreint, garder /global ou stocker par pays (à trancher si besoin).
> - Les 11 pays du référentiel deviennent un sujet séparé, pour le 35 attendu. Leur effet sur « pays ayant répondu » est à soumettre à l'utilisateur.

## Option
- **Vue SQL simple** (pas matérialisée), en deux niveaux :
  - `planning_key_summary` : une ligne par clé (cost_key_id, year, pole, status, total_seats) ;
  - `planning_key_country_summary` : une ligne par clé et par pays (country_code, answered, in_lines, needs).
- Elle lit en direct PlannedSession, PlannedAllocation, les pays enrôlés et le snapshot de la clé gelée : rien à invalider pour les places.
- **Seule écriture à l'écriture** : la table `planning_needsline` (year, pole, country FK, brand FK, needs, technicians, unique (year, pole, country, brand)).
  - Elle contient les besoins de `NeedsCopyYear`, pays et marques déjà résolus.
  - Elle est remplie avec `_parse_needs(_by_pole(payload, "needs_by_branch_brand", pole))` de `clients/needs.py` : c'est le chemin de /global, sans dupliquer la règle.
- **Places** : le front appelle `yearGlobal(a)` sans mode, donc toujours PLANNED (views.py:127).
  - Clé gelée : `snapshot.report.total_seats` et `snapshot.report.lines`.
  - Sinon : somme des PlannedAllocation des pays enrôlés (cost_key.py:207-208).
- **Pays de l'Academy** : `referential.Country` n'en a que 24 (seed_referential.py:36-63), contre 35 dans le front. Ajouter au seed, en création seulement, les 11 manquants : sle Sierra Leone, lbr Libéria, eth Éthiopie, dji Djibouti, ago Angola, zmb Zambie, zwe Zimbabwe, moz Mozambique, mwi Malawi, mus Maurice, reu La Réunion. Puis compter `Country.objects.filter(is_active=True)`.

## Changements, dans l'ordre
1. `planning/models.py`
   - Modèle `NeedsLine`.
   - Champ `NeedsCopyState.lines_version` (BigIntegerField, null).
   - Deux modèles non gérés (`managed=False`) : `KeySummary` (planning_key_summary) et `KeyCountrySummary` (planning_key_country_summary).
   - Signaux `post_save` et `post_delete` sur Country, CountryAlias, Brand et BrandAlias, vers `invalidate_needs_lines()`, qui fait `NeedsCopyState.objects.filter(pk=1).update(lines_version=None)`. À brancher près des `m2m_changed.connect` (~l.490).
2. `planning/migrations/0013_needs_lines_summary.py` (dépend de 0012 et de referential 0003)
   - CreateModel, AddField, puis `RunPython(create_views, drop_views)` avec un SQL choisi selon `connection.vendor` (postgresql ou sqlite).
   - Pas de remplissage dans la migration.
   - Commentaire en tête : toute migration future qui change le type d'une colonne lue par la vue doit supprimer la vue puis la recréer.
3. `planning/services/needs_lines.py` (nouveau, imports de clients.needs locaux pour éviter le cycle)
   - `rebuild()` : supprime tout, puis réinsère depuis chaque NeedsCopyYear et chaque Pole, par `bulk_create` des entrées de `by_cell`. Positionne `lines_version = version`.
   - `ensure_needs_lines()` : sans effet si la version est nulle ou déjà à jour, sinon `rebuild()`.
4. Appels de `rebuild()` et `ensure_needs_lines()`
   - `services/needs_copy.py:99` : dans `apply_snapshot`, `rebuild()` juste avant `state.save()`, même transaction.
   - `management/commands/sync_needs_snapshot.py` : `ensure_needs_lines()` après `refresh_from_needs`.
   - Le job migrate (docker-compose.yml:37) remplit ainsi la prod existante (§7).
5. `referential/.../seed_referential.py:36-63` : les 11 pays.
6. `planning/services/year_summary.py` : `year_summaries(keys, visible_by_year) -> list[dict]`, par année :
   - answered = pays distincts avec answered ;
   - known = pays distincts avec answered ou in_lines ;
   - needs = somme des needs là où in_lines ;
   - seats = somme des total_seats ;
   - status = FROZEN si toutes les clés sont gelées ;
   - `poles` donne le détail ; `visible` s'applique comme dans `consolidate`.
7. `planning/views.py` (après YearGlobalView, l.486) : `YearSummaryView`.
   - `allow(planning_cost_key, list)`, puis `ensure_needs_lines()`.
   - Clés filtrées par `cerbos.check(_key_attr(k), "view")`, comme `_year_keys` l.427, et `_year_visible`.
   - Renvoie `{"academy_countries": N, "years": [...]}`.
8. `planning/urls.py:23` : `path("years/summary", ...)`.
9. Cerbos : aucun changement de droit (mêmes ressources que /global).
10. `frontend/src/lib/planningApi.js` : `yearSummary: () => http.get('/years/summary')`.
11. `CenterDirectorSections.jsx`
    - Supprimer `cartographie` et `PAYS_ACADEMY`.
    - `paysAttendus` lit `a.paysAcademy`.
    - Nouvelle fonction `syntheseResume(y, paysAcademy)`.
    - `useAnnees` fait un seul appel `yearSummary()`.
    - Garder `syntheseAnnee`, que CenterHome.jsx:61 utilise.
12. `CenterHome.jsx:24,123,211` : `PAYS_ACADEMY` est remplacé par `academy_countries`.
13. `CenterHome.test.js:4,63-68` : passer `paysAcademy: 35`, et ajouter un test de `syntheseResume`.

## SQL de la vue (Postgres, brouillon)
```sql
CREATE VIEW planning_key_summary AS
SELECT k.id AS cost_key_id, k.year, k.pole, k.status,
  CASE WHEN k.status = 'FROZEN' THEN (s.report ->> 'total_seats')::int
  ELSE COALESCE((SELECT SUM(pa.seats) FROM planning_plannedallocation pa
       JOIN planning_plannedsession ps ON ps.id = pa.planned_session_id
       JOIN planning_costkeyyear_enrolled_countries e
         ON e.costkeyyear_id = k.id AND e.country_id = pa.country_id
       WHERE ps.cost_key_id = k.id), 0) END AS total_seats
FROM planning_costkeyyear k
LEFT JOIN planning_costkeysnapshot s ON s.cost_key_id = k.id;

CREATE VIEW planning_key_country_summary AS
WITH lines AS (
  SELECT k.id AS cost_key_id, c.id AS country_id
  FROM planning_costkeyyear k
  JOIN planning_costkeysnapshot s ON s.cost_key_id = k.id
  CROSS JOIN LATERAL jsonb_array_elements(s.report -> 'lines') l
  JOIN referential_country c ON c.code = l ->> 'code'
  WHERE k.status = 'FROZEN'
  UNION SELECT e.costkeyyear_id, e.country_id FROM planning_costkeyyear_enrolled_countries e
    JOIN planning_costkeyyear k ON k.id = e.costkeyyear_id AND k.status <> 'FROZEN'
  UNION SELECT ps.cost_key_id, pa.country_id FROM planning_plannedallocation pa
    JOIN planning_plannedsession ps ON ps.id = pa.planned_session_id
    JOIN planning_costkeyyear k ON k.id = ps.cost_key_id AND k.status <> 'FROZEN'
  UNION SELECT ps.cost_key_id, ps.country_id FROM planning_plannedsession ps
    JOIN planning_costkeyyear k ON k.id = ps.cost_key_id AND k.status <> 'FROZEN'
),
needs AS (SELECT year, pole, country_id, SUM(needs) AS needs FROM planning_needsline GROUP BY 1, 2, 3),
pairs AS (SELECT cost_key_id, country_id FROM lines
  UNION SELECT k.id, n.country_id FROM planning_costkeyyear k JOIN needs n ON n.year = k.year AND n.pole = k.pole)
SELECT k.id AS cost_key_id, k.year, k.pole, k.status, c.code AS country_code,
       COALESCE(n.needs, 0) > 0 AS answered, l.country_id IS NOT NULL AS in_lines,
       COALESCE(n.needs, 0) AS needs
FROM pairs p
JOIN planning_costkeyyear k ON k.id = p.cost_key_id
JOIN referential_country c ON c.id = p.country_id
LEFT JOIN lines l ON l.cost_key_id = p.cost_key_id AND l.country_id = p.country_id
LEFT JOIN needs n ON n.year = k.year AND n.pole = k.pole AND n.country_id = p.country_id;
```
Variante SQLite (tests) : `json_each(s.report, '$.lines')` et `json_extract`. Les booléens valent 0 ou 1, à convertir avec `bool()`.

## Tests et preuve
- `planning/tests/test_year_summary.py` : une référence `from_global` (la logique de `syntheseAnnee` sur `consolidate([global_table(...)])`) doit être égale à `year_summaries` dans ces cas :
  - clé en brouillon ;
  - pays non enrôlé avec des places ;
  - pays avec des besoins hors clé ;
  - clé gelée ;
  - libellé inconnu ;
  - alias ajouté après la copie ;
  - pôle absent de la copie, donc repli sur « all » ;
  - aucune copie ;
  - lecteur restreint.
- Idempotence : `ensure_needs_lines()` renvoie False au second appel (`django_assert_num_queries`), et `sync_needs_snapshot` remplit la table quand `lines_version` est nul.
- Endpoint : 403 sans `list`, une clé non lisible est exclue, `academy_countries` vaut le nombre de pays actifs.
- Postgres : relancer avec `config.settings.test_pg`, sur le modèle de test_cost_key_cells_pg.py.
- Recette : une commande `check_year_summary` compare /global et le résumé.
  - Attendu 2027 : 8/35 pays, 727 besoins, 35 filiales, 135 places.
  - Attendu 2026 : 20/24, 2 158, 24, 1 481.
- vitest : CenterHome.test.js.

## Risques
- **À VÉRIFIER AVANT DE LIVRER** : les 11 pays ajoutés changent aussi /global. Des besoins aujourd'hui ignorés (`unknown_country`, par exemple « Angola ») seraient comptés, et 2027 pourrait dépasser 8 pays ayant répondu. Lire les `warnings` de /years/2027/global en recette. Si les chiffres bougent, c'est une décision métier à soumettre à l'utilisateur.
- **Seul écart possible avec /global** : `compute` n'ajoute un pays qui accueille une session que s'il y a un hébergement formateur (`session_has_trainer_lodging`). Le cas est rare et `check_year_summary` le détecte.
- **Signaux** : un `update()` ou `bulk_create` sur les alias ne les déclenche pas. Appeler alors `invalidate_needs_lines()` à la main.
- **Ordre au démarrage** : migrate, puis seed_referential, puis sync_needs_snapshot.
- **Restes** : un appel Cerbos par clé dans le résumé, et CenterHome qui garde un appel /global tant que le point 12 n'est pas complet.
