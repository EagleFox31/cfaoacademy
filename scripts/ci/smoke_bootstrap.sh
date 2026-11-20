#!/usr/bin/env bash
# Smoke AGENTS.md section 7 d'un module Django + Postgres, sur une base vide :
#   1. `up` monte la base par le seul job *-migrate (sorti en 0), sans commande manuelle ;
#   2. `migrate --check` : aucune migration en attente ;
#   3. rejeu du job : zero ecriture (somme ins+upd+del de pg_stat_user_tables inchangee).
#
#   bash scripts/ci/smoke_bootstrap.sh <compose> <job> <db> <service>...
#   ex. bash scripts/ci/smoke_bootstrap.sh cfao-needs/docker-compose.prod.yml \
#         needs-migrate needs-db needs-api needs-worker
#
# Les variables exigees par le compose (secrets, reseaux externes) viennent de
# l'appelant. Projet compose dedie `smoke-<dossier>`, detruit au debut et a la fin
# (sauf KEEP=1).
set -euo pipefail

FILE=$1 JOB=$2 DB=$3
shift 3
PROJET="smoke-$(basename "$(dirname "$(realpath "$FILE")")")"
DC="docker compose -p $PROJET -f $FILE"

nettoyer() { [ "${KEEP:-0}" = 1 ] || $DC down -v --remove-orphans >/dev/null 2>&1 || true; }
trap nettoyer EXIT

ecritures() {
  # Les compteurs d'un backend sont publies a sa deconnexion : on laisse passer la seconde.
  sleep 2
  $DC exec -T "$DB" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) from pg_stat_user_tables"' | tr -d '[:space:]'
}

$DC down -v --remove-orphans >/dev/null 2>&1 || true

echo "== base vide : up"
$DC up -d --wait "$@"
code=$(docker inspect -f '{{.State.ExitCode}}' "$($DC ps -aq "$JOB")")
[ "$code" = 0 ] || { echo "ECHEC : $JOB sorti en $code" >&2; $DC logs "$JOB" | tail -n 30; exit 1; }
echo "ok   $JOB sorti en 0, services prets : $*"

$DC run --rm --no-deps "$JOB" python manage.py migrate --check >/dev/null
echo "ok   aucune migration en attente"

echo "== rejeu du job sur la base a jour"
$DC stop "$@" >/dev/null 2>&1
avant=$(ecritures)
$DC run --rm --no-deps "$JOB" >/dev/null
apres=$(ecritures)
[ "$avant" = "$apres" ] || { echo "ECHEC : rejeu = $((apres - avant)) ecriture(s)" >&2; exit 1; }
echo "ok   rejeu : 0 ecriture ($avant lignes ecrites au premier passage)"
