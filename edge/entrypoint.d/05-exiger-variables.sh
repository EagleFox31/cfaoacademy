#!/bin/sh
# Avant le rendu des modèles : une variable manquante bloque le démarrage au lieu
# de produire une configuration fausse en silence.
set -eu

for v in EDGE_LISTEN EDGE_PUBLIC_PROTO EDGE_PUBLIC_HOST EDGE_PUBLIC_PORT EDGE_NEEDS_UPSTREAM; do
    eval "valeur=\${$v:-}"
    if [ -z "$valeur" ]; then
        echo "cfao-edge: $v manquant" >&2
        exit 1
    fi
done

case "$EDGE_PUBLIC_PROTO" in
    http|https) ;;
    *) echo "cfao-edge: EDGE_PUBLIC_PROTO doit valoir http ou https" >&2; exit 1 ;;
esac

# Le rendu des modèles exige un dossier de sortie existant (tmpfs vide au départ).
mkdir -p "$NGINX_ENVSUBST_OUTPUT_DIR"
