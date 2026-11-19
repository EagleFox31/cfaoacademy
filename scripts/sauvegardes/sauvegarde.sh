#!/usr/bin/env bash
# Sauvegarde des modules CFAO Academy : bases Postgres (pg_dump dans le conteneur,
# donc même version que le serveur) et dossier des comptes rendus (SQLite copiés à
# chaud par l'API de sauvegarde SQLite, puis archive).
# Lecture seule sur les modules : aucun arrêt, aucun verrou long.
#
#   sauvegarde.sh                      # une passe, rotation comprise
#   cron : 15 2 * * * $HOME/bin/cfao-sauvegarde.sh >> $HOME/backups/sauvegarde.log 2>&1
#
# Variables (toutes facultatives) :
#   SAUVEGARDE_DIR         dossier cible (défaut $HOME/backups)
#   SAUVEGARDE_JOURS       rétention en jours (défaut 14)
#   SAUVEGARDE_BASES       "conteneur:utilisateur:base ..." (défaut : les 4 bases CFAO)
#   SAUVEGARDE_CR_DIR      dossier des comptes rendus (vide = ignoré)
#   SAUVEGARDE_COPIE       destination scp hors serveur, ex. hote:/chemin (vide = aucune)
# Code de sortie : 0 si tout a réussi, 1 si au moins un élément a échoué.
set -uo pipefail
umask 077

DEST="${SAUVEGARDE_DIR:-$HOME/backups}"
JOURS="${SAUVEGARDE_JOURS:-14}"
BASES="${SAUVEGARDE_BASES:-cfao-needs-needs-db-1:needs:needs cfao-planning-planning-db-1:planning:planning cfao-core-core-db-1:core:core cfao-identity-keycloak-db-1:keycloak:keycloak}"
CR_DIR="${SAUVEGARDE_CR_DIR-/srv/apps/cfao-compte-rendus/data}"
COPIE="${SAUVEGARDE_COPIE:-}"
PY="${PYTHON:-python3}"

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }   # sans effet hors Git Bash
log() { printf '%s %s\n' "$(date '+%F %T')" "$*"; }

mkdir -p "$DEST"
# Une seule passe à la fois (cron + lancement manuel).
if command -v flock >/dev/null; then
  exec 9>"$DEST/.verrou"
  flock -n 9 || { log "une sauvegarde tourne déjà, abandon"; exit 0; }
fi

STAMP="$(date '+%Y%m%d-%H%M')"
LOT="$DEST/$STAMP"
mkdir -p "$LOT"
echecs=0

for entree in $BASES; do
  IFS=: read -r conteneur utilisateur base <<<"$entree"
  cible="$LOT/$base.dump"
  # Format custom : compressé, restaurable table par table.
  if dk exec "$conteneur" pg_dump -U "$utilisateur" -d "$base" -Fc >"$cible.partiel" \
     && [ -s "$cible.partiel" ]; then
    mv "$cible.partiel" "$cible"
    log "ok   $base ($(du -h "$cible" | cut -f1))"
  else
    rm -f "$cible.partiel"
    log "ÉCHEC $base (conteneur $conteneur)"
    echecs=$((echecs + 1))
  fi
done

if [ -n "$CR_DIR" ]; then
  tmp="$LOT/.cr"
  mkdir -p "$tmp"
  # Copie cohérente des SQLite en service, puis archive du reste (hors cache).
  if "$PY" - "$CR_DIR" "$tmp" <<'PY'
import pathlib, sqlite3, sys
src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
for f in sorted(src.iterdir()):
    if f.is_file() and f.suffix in (".sqlite", ".sqlite3"):
        with sqlite3.connect(f"file:{f}?mode=ro", uri=True) as a, sqlite3.connect(dst / f.name) as b:
            a.backup(b)
PY
  then
    arch="$LOT/comptes-rendus.tar"
    # Deux passes : les exclusions de la première ne touchent pas les copies.
    if tar -cf "$arch" -C "$CR_DIR" --exclude=./cache --exclude='./*.sqlite' --exclude='./*.sqlite3' . \
       && tar -rf "$arch" -C "$tmp" . \
       && gzip -f "$arch"; then
      log "ok   comptes-rendus ($(du -h "$LOT/comptes-rendus.tar.gz" | cut -f1))"
    else
      rm -f "$arch" "$arch.gz"
      log "ÉCHEC comptes-rendus (archive)"; echecs=$((echecs + 1))
    fi
  else
    log "ÉCHEC comptes-rendus (copie SQLite)"; echecs=$((echecs + 1))
  fi
  rm -rf "$tmp"
fi

( cd "$LOT" && sha256sum -- * >SHA256SUMS 2>/dev/null )
[ "$echecs" -eq 0 ] && : >"$LOT/COMPLET"

if [ -n "$COPIE" ]; then
  if scp -q -r "$LOT" "$COPIE/"; then log "ok   copie hors serveur"
  else log "ÉCHEC copie hors serveur"; echecs=$((echecs + 1)); fi
fi

# Rotation : seuls les lots datés, jamais le dernier lot complet.
dernier_complet="$(ls -1d "$DEST"/20*/ 2>/dev/null | while read -r d; do [ -e "$d/COMPLET" ] && echo "${d%/}"; done | tail -1)"
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$JOURS" | while read -r d; do
  [ "$d" = "$dernier_complet" ] || { rm -rf -- "$d"; log "rotation : $(basename "$d") supprimé"; }
done

log "fin $STAMP : $echecs échec(s)"
[ "$echecs" -eq 0 ]
