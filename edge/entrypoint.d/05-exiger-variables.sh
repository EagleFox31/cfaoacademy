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

# Écoutes directes du LAN : « module@adresse:port », séparées par des espaces ou
# des virgules. Un module y est servi seulement s'il a un modèle LAN et une adresse.
vues=" $EDGE_LISTEN "
for e in $(echo "${EDGE_LAN:-}" | tr ',' ' '); do
    if ! echo "$e" | grep -Eq '^[a-z]+@[^@]+:[0-9]+$'; then
        echo "cfao-edge: EDGE_LAN : « $e » n'est pas de la forme module@adresse:port" >&2
        exit 1
    fi
    module=${e%%@*}
    ecoute=${e#*@}
    if [ ! -f "/etc/nginx/templates/lan/$module.conf.template" ]; then
        echo "cfao-edge: EDGE_LAN : module « $module » sans écoute LAN" >&2
        exit 1
    fi
    amont="EDGE_$(echo "$module" | tr a-z A-Z)_UPSTREAM"
    eval "valeur=\${$amont:-}"
    if [ -z "$valeur" ]; then
        echo "cfao-edge: EDGE_LAN : $module écouté mais $amont vide" >&2
        exit 1
    fi
    case "$vues" in
        *" $ecoute "*) echo "cfao-edge: EDGE_LAN : $ecoute déjà écouté" >&2; exit 1 ;;
    esac
    vues="$vues$ecoute "
done

# Le rendu des modèles exige un dossier de sortie existant (tmpfs vide au départ).
mkdir -p "$NGINX_ENVSUBST_OUTPUT_DIR"
