# Plan : création de base automatique par module (AGENTS.md §7)

Patron : dans chaque compose, job `<prefix>-migrate` (image de l'API, `restart: "no"`), une seule commande `bootstrap` par module (migrate puis référentiel « créer seulement ce qui manque »). API et workers en `depends_on: service_completed_successfully`. Seeds corrigés **avant** câblage. Garde CI statique sur tous les composes.

## Inventaire

| Module | Stack | Seeds | Migrations aujourd'hui | Composes |
|---|---|---|---|---|
| cfao-needs | Django, Postgres | `seed_referential`, `seed_catalog`, `seed_email_templates` (+ `wait_for_schema` worker) | manuel `cfao-needs/Makefile:17-23` | `docker-compose.yml`, `docker-compose.prod.yml` |
| cfao-academy-mail | Django, Postgres | `seed_email_templates` (conforme) | CMD `migrate && gunicorn` (`Dockerfile`, dernière ligne) | `docker-compose.yml` (mail-api, mail-worker l.41-55) |
| cfao-comptes-rendus | Django, Postgres (SQLite en intégré) | `compte_technique` (conforme, écrit dans `/donnees`) | `api/Dockerfile:59` CMD `migrate && compte_technique && gunicorn` | dev l.54, prod l.48 ; racine `rapports` l.224-246 |
| cfao-core | Django, Postgres | `seed_dev` (démo destructive : `all().delete()` `identity/.../seed_dev.py:107-110`) → exclu ; job = `migrate` seul | racine `docker-compose.yml:152-153` | racine + `docker-compose.override.yml:10-12` |
| cfao-planning (non suivi) | Django | `seed_referential`, `seed_cost_key` | manuel | aucun compose |
| cfao-operations | Node, aucun pilote Postgres | `ops-db` rempli hors bande (`scripts/ingestion/init_ops_schema.sql`) | n/a | racine l.173-216 → allowlist |
| keycloak | Liquibase (éditeur) + keycloak-config-cli | job `config` | `keycloak/compose.prod.yml:60-79`, `profiles: [config]` l.62 | phase 2 : retirer le profil |
| template-service | Django | `make seed` = `loaddata sample_fixtures.json` (démo) | manuel | `template-service/docker-compose.yml` |
| `scripts/new_module.py` | apps dans core | — | message l.289 | hérite de core |

## Audit seeds (non conformes)

needs (`cfao-needs/api/`) :
- `referential/.../seed_referential.py` : l.134-140 familles `update_or_create` (remet `status` PENDING, écrase label/sort_order/section) ; l.150-153 marques (écrase, réactive) ; l.163-165 alias ; l.174-180 org units (écrase, réactive) ; l.186-194 profils = démo, écrasent roles/org_unit/keycloak_sub des 7 comptes serveur → derrière `--demo` (avec unités Douala/Abidjan/Accra et `--open`), seule racine `groupe` hors démo. Tout en `get_or_create`, `brands.set` à la création seulement. Campagne l.196-216 conforme.
- `campaigns/.../seed_catalog.py` : l.39-43 `CommandError` si campagne non DRAFT → job en 1, API jamais démarrée → `return` code 0. Via `campaigns/imports/catalog.py:254` delete-all + `bulk_create` (PK changent, `ImportLog`, `ProtectedError` si `Need` → FK PROTECT `campaigns/models.py:223`). Correction : ne charger que les familles READY sans aucune ligne ; `CatalogImporter.write(rows, replace=True)`, le seed passe `replace=False`.
- `outbound/.../seed_email_templates.py:298-306` : `update_or_create(version=1)` écrase et réactive → deux actifs, `resolve_template` ambigu (`outbound/services/render.py:34-36`). Patron mail : `exists()` → `continue`, sinon `create`.
- Hors job : `import_participants_referential.py:68-97` remet `country=""`.

planning (`cfao-planning/api/`) : `seed_cost_key.py:44-45` `update_or_create` + `set()` sur clé gelée → `FrozenKeyError` (`planning/models.py:217-229`, l.401) → `get_or_create`, `set()` à la création ; `referential/.../seed_referential.py:130-175` sept `update_or_create` → `get_or_create`.

## Plan ordonné

1. Garde CI (rouge d'abord) `scripts/ci/test_compose_bootstrap.py` + job `composes` dans `.github/workflows/ci.yml` (sans filtre de chemins).
2. needs code → **api v0.1.4** : corrections ci-dessus ; `core/management/commands/bootstrap.py` (migrate, seed_referential [--demo], seed_catalog, seed_email_templates) ; adapter `campaigns/tests/test_seed_catalog.py` ; commentaire `api/Dockerfile:33-36` (CMD inchangé).
3. needs composes : `needs-migrate` (v0.1.4, `*api_env`, `networks: [default]`, `restart: "no"`, `mem_limit: 384m`, `command: [python, manage.py, bootstrap]`, dépend de needs-db healthy) ; needs-api (l.67-71) et needs-worker (l.86-88) en dépendent ; **worker sur l'image de l'API** (`cfao-needs-worker:v0.1.0` en retard). Dev : `build: ./api`, volume, `bootstrap --demo`, l.145-149, l.170-173. Makefile → `run --rm needs-migrate` + `seed-demo-open`. README l.19-20, l.96-100, décision 10 l.293.
4. mail : CMD gunicorn seul ; `mail-migrate` (`migrate --noinput && seed_email_templates`).
5. comptes-rendus : CMD gunicorn seul (v0.4.2) ou `command:` gunicorn explicite sur v0.4.1 ; ancre d'env ; `migrate` avec `env_file`, volume `cr-donnees` ; Makefile l.42-43.
6. Compose racine : `core` runserver seul + `core-migrate` ; `rapports-migrate` (volume `rapports-donnees`) ; override commentaire l.8.
7. Gabarit : `service-migrate`, `bootstrap.py` + helper `core/seeding.py` (`ensure(model, lookup, defaults)`, compte les créations, n'écrit jamais l'existant) + test ; Makefile `seed` → `seed-demo` ; README ; `scripts/new_module.py:289`.
8. Keycloak prod (phase 2) : retirer `profiles: [config]` (checksum keycloak-config-cli, remote-state) ; vérifier que les `:?` de `config` ne cassent pas `up`.
9. Planning : corriger les seeds ; futur compose avec `planning-migrate`.
10. Operations : allowlist justifiée.
11. Leçon 2026-10-30 : ajouter la garde CI comme contrôle renforcé.

## Garde CI (règles)

Fichiers `git ls-files '*compose*.y*ml'`. Base = image `^(postgres|mysql|mariadb|mongo)`. Consommateur = dépend d'une base ou env `(^|_)(DB_HOST|DATABASE_URL|DB_URL)$`. Exige : (a) service `(^|-)migrate$` de même image/build qu'un consommateur ; (b) `restart == "no"` (chaîne), sans profiles/ports/healthcheck ; (c) chaque consommateur `depends_on[migrate].condition == service_completed_successfully` ; (d) ni command/entrypoint du consommateur ni CMD/ENTRYPOINT de son Dockerfile ne contiennent `\bmigrate\b|upgrade head|db push|seed` ; (e) fichiers `*prod*` : pas de `--demo|--open|seed_dev|loaddata|sample`. Allowlist commentée : keycloak, operations. Tests négatifs sur fixtures YAML.

## Preuves

- needs `core/tests/test_bootstrap.py` : base vide → 8 familles, 21 marques, 255 lignes (hors Yamaha), 28 modèles, campagne DRAFT, 0 UserProfile ; 2e passage sous `CaptureQueriesContext` = aucun INSERT/UPDATE/DELETE ; brownfield (campagne OPEN, Yamaha READY, libellé/inactif/sujet/rôles/titre modifiés) → code 0, tout préservé, alias supprimé recréé ; `--demo` → 7 profils puis 0 écriture.
- planning : idem + clé gelée. mail, CR : 2e passage = 0 écriture.
- Smoke `scripts/ci/smoke_bootstrap.sh` : `down -v` + `up -d` → job 0 + `migrate --check` + requête qui lit la base ; `pg_stat_user_tables` (ins+upd+del) identique avant/après `run --rm migrate` ; brownfield v0.1.3 + mutations SQL → nouvelle image → valeurs vérifiées.

## Serveur needs

- **Ne pas** lancer `bootstrap` sur v0.1.3 (seed_catalog en 1 sur campagne ouverte, seed_referential écrase).
- Option rapide : `needs-migrate` sur v0.1.3 avec `migrate --noinput` seul.
- Cible : `pg_dump` serveur (lecture) → rejeu v0.1.4 sur copie locale (diff = ajouts seulement) → sauvegarde compose/.env → `up -d` → `ps -a` (migrate sorti en 0) + logs. La migration 0004 peut s'appliquer à ce moment.

## Risques

- `docker compose version` serveur ≥ 2.20 à vérifier ; le déploiement contrôle le code de sortie du job.
- Échec du job = API arrêtée (voulu) → documenter dans `PUBLIER_IMAGES.md`.
- Redémarrage hôte : API relancée sans job, sans risque.
- Comptes de démo `@cfao.com` déjà sur le serveur : pas de suppression automatique, décision utilisateur.
- `sort_order` des lignes ajoutées repart de 0 : vérifier le tri par famille.
- needs prod en `config.settings.dev` : la démo ne dépend que de `--demo`, jamais de `DEBUG`.
