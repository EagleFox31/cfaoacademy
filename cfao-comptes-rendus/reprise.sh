#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Reprise d'un export formateurs (db.sqlite3 + profils.json + donnees/photos)
# dans la pile de prod (PostgreSQL). A lancer UNE fois, apres ./deploy.sh :
#   ./reprise.sh donnees-formateurs-20261009
# ==============================================================================

SOURCE="${1:?Usage : ./reprise.sh <dossier d'export>}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
C="docker compose --env-file $ENV_FILE -f $COMPOSE_FILE"
SOURCE="$(cd "$SOURCE" && pwd)"
API="$($C ps -q api)"
[ -n "$API" ] || { echo "Le service api ne tourne pas : lancer ./deploy.sh d'abord."; exit 1; }

# 1. SQLite -> JSON (copie de travail, l'export n'est jamais modifie)
TRAVAIL="$(mktemp -d)"
cp "$SOURCE/db.sqlite3" "$TRAVAIL/"
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$API")"
docker run --rm -v "$TRAVAIL:/import" -e DEPLOYMENT_MODE=standalone -e DEBUG=True \
  -e SECRET_KEY=reprise -e DATABASE_URL=sqlite:////import/db.sqlite3 --entrypoint sh "$IMAGE" \
  -c "python manage.py migrate -v0 && python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -o /import/reprise.json"

# 2. Donnees, photos et profils dans le service
docker cp "$TRAVAIL/reprise.json" "$API:/tmp/reprise.json"
docker cp "$SOURCE/donnees/photos" "$API:/donnees/"
docker cp "$SOURCE/profils.json" "$API:/donnees/profils-locaux.json"
$C exec -T -u root api chown -R service:service /donnees
$C exec -T api python manage.py loaddata /tmp/reprise.json
$C exec -T api python manage.py shell -c \
  "from django.apps import apps; print({m.__name__: m.objects.count() for m in apps.get_app_config('comptes_rendus').get_models()})"

echo "Reprise terminee. Creer les mots de passe : $C exec api python manage.py mot_de_passe <identifiant>"
