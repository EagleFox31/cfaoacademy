#!/bin/sh
# Après le rendu des modèles : URL vue des navigateurs, choisie dans une liste
# blanche (EDGE_ORIGINES, validée par 05) d'après l'hôte reçu (X-Forwarded-Host
# posé par Caddy ou zrok, sinon Host). Hôte inconnu = URL publique canonique.
# Le schéma vient de la liste, jamais de X-Forwarded-Proto.
set -eu

sortie="$NGINX_ENVSUBST_OUTPUT_DIR/origines.conf"
proto=""; hote=""; port=""

for o in $(echo "${EDGE_ORIGINES:-}" | tr ',' ' '); do
    p=${o%%://*}
    reste=$(echo "${o#*://}" | tr A-Z a-z)
    h=${reste%%:*}
    defaut=443
    [ "$p" = http ] && defaut=80
    n=$defaut
    [ "$reste" != "$h" ] && n=${reste#*:}
    cles="$h:$n"
    [ "$n" = "$defaut" ] && cles="$cles $h"
    for c in $cles; do
        proto="$proto    \"$c\" $p;
"
        hote="$hote    \"$c\" $h;
"
        port="$port    \"$c\" $n;
"
    done
done

{
    echo 'map $http_x_forwarded_host $edge_req_cle {'
    echo '    ""      $http_host;'
    echo '    default $http_x_forwarded_host;'
    echo '}'
    printf 'map $edge_req_cle $edge_req_proto {\n    default %s;\n%s}\n' "$EDGE_PUBLIC_PROTO" "$proto"
    printf 'map $edge_req_cle $edge_req_host {\n    default %s;\n%s}\n' "$EDGE_PUBLIC_HOST" "$hote"
    printf 'map $edge_req_cle $edge_req_port {\n    default %s;\n%s}\n' "$EDGE_PUBLIC_PORT" "$port"
} > "$sortie"

echo "cfao-edge: origines : ${EDGE_ORIGINES:-aucune} (défaut ${EDGE_PUBLIC_PROTO}://${EDGE_PUBLIC_HOST}:${EDGE_PUBLIC_PORT})"
