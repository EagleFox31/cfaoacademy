#!/bin/sh
# Vignette JPG à côté de chaque vidéo d'article (même nom, extension .jpg),
# tirée à la 8e seconde. Les cartes et le haut d'article l'affichent tout de
# suite, sans attendre la vidéo. Idempotent : une vignette existante est gardée
# (la supprimer pour la refaire, ou passer SECONDE=… pour une autre image).
#
# Depuis la racine du dépôt, dans un conteneur jetable :
#   docker run --rm -v "$PWD/assets/videos_articles:/videos" -v "$PWD/frontend/scripts:/s:ro" \
#     alpine:latest sh /s/vignettes-videos.sh
set -eu
DOSSIER=${DOSSIER:-/videos}
SECONDE=${SECONDE:-8}
command -v ffmpeg >/dev/null || apk add --no-cache ffmpeg >/dev/null

for video in "$DOSSIER"/*.mp4 "$DOSSIER"/*.webm; do
  [ -f "$video" ] || continue
  vignette="${video%.*}.jpg"
  if [ -f "$vignette" ]; then
    echo "gardée : $(basename "$vignette")"
    continue
  fi
  ffmpeg -loglevel error -ss "$SECONDE" -i "$video" -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 4 "$vignette"
  echo "créée  : $(basename "$vignette")"
done
