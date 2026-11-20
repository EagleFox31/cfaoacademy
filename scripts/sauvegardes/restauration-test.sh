#!/usr/bin/env bash
# Test de restauration du dernier lot complet (ou du lot passé en argument).
# Chaque dump est restauré dans un Postgres jetable (sans port publié, données en
# mémoire, supprimé à la fin) ; les SQLite des comptes rendus passent
# integrity_check. Aucun conteneur en service n'est touché.
#
#   restauration-test.sh [dossier-du-lot]
#   cron : 45 2 * * 0 $HOME/bin/cfao-restauration-test.sh >> $HOME/backups/restauration.log 2>&1
# Code de sortie : 0 si tout se restaure, 1 sinon.
set -uo pipefail

DEST="${SAUVEGARDE_DIR:-$HOME/backups}"
IMAGE="${RESTAURATION_IMAGE:-postgres:16-alpine}"
PY="${PYTHON:-python3}"
dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }

LOT="${1:-$(ls -1d "$DEST"/20*/ 2>/dev/null | while read -r d; do [ -e "$d/COMPLET" ] && echo "${d%/}"; done | tail -1)}"
[ -n "$LOT" ] && [ -d "$LOT" ] || { log "ÉCHEC aucun lot complet dans $DEST"; exit 1; }
log "lot testé : $LOT"
echecs=0

if ( cd "$LOT" && sha256sum -c --quiet SHA256SUMS ); then log "ok   empreintes"
else log "ÉCHEC empreintes"; echecs=$((echecs + 1)); fi

NOM="cfao-restauration-test-$$"
trap 'dk rm -f "$NOM" >/dev/null 2>&1' EXIT
dumps=("$LOT"/*.dump)
if [ -e "${dumps[0]}" ]; then
  dk run -d --rm --name "$NOM" --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
     --tmpfs /var/lib/postgresql/data "$IMAGE" >/dev/null
  # Prêt quand il écoute en TCP (le serveur d'initialisation n'écoute que le socket).
  for _ in $(seq 60); do dk exec "$NOM" pg_isready -q -h 127.0.0.1 -U postgres && break; sleep 1; done

  for dump in "${dumps[@]}"; do
    base="$(basename "$dump" .dump)"
    dk exec "$NOM" createdb -U postgres "t_$base"
    if dk exec -i "$NOM" pg_restore -U postgres -d "t_$base" --no-owner --no-acl --exit-on-error <"$dump"; then
      tables="$(dk exec "$NOM" psql -U postgres -d "t_$base" -Atc \
        "select count(*) from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")"
      if [ "${tables:-0}" -gt 0 ]; then log "ok   $base restauré ($tables tables)"
      else log "ÉCHEC $base restauré mais vide"; echecs=$((echecs + 1)); fi
    else
      log "ÉCHEC $base (pg_restore)"; echecs=$((echecs + 1))
    fi
  done
fi

if [ -f "$LOT/comptes-rendus.tar.gz" ]; then
  tmp="$(mktemp -d)"
  if tar -xzf "$LOT/comptes-rendus.tar.gz" -C "$tmp" && "$PY" - "$tmp" <<'PY'
import pathlib, sqlite3, sys
fichiers = [f for f in pathlib.Path(sys.argv[1]).iterdir() if f.suffix in (".sqlite", ".sqlite3")]
assert fichiers, "aucune base SQLite dans l'archive"
for f in fichiers:
    with sqlite3.connect(f) as c:
        assert c.execute("pragma integrity_check").fetchone()[0] == "ok", f.name
        n = c.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]
        print(f"     {f.name} : {n} tables")
PY
  then log "ok   comptes-rendus extrait et intègre"
  else log "ÉCHEC comptes-rendus"; echecs=$((echecs + 1)); fi
  rm -rf "$tmp"
fi

log "fin du test : $echecs échec(s)"
[ "$echecs" -eq 0 ]
