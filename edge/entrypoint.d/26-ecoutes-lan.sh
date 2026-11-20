#!/bin/sh
# Après le rendu des modèles : un bloc server par module de EDGE_LAN (validé par
# 05), avec toutes ses adresses ; ses routes viennent de lan/<module>.conf.
set -eu

sortie="$NGINX_ENVSUBST_OUTPUT_DIR/lan.conf"
entrees=$(echo "${EDGE_LAN:-}" | tr ',' ' ')
: > "$sortie"

for module in $(for e in $entrees; do echo "${e%%@*}"; done | sort -u); do
    {
        echo "server {"
        for e in $entrees; do
            if [ "${e%%@*}" = "$module" ]; then
                echo "    listen ${e#*@};"
            fi
        done
        echo "    server_name _;"
        echo "    absolute_redirect off;"
        echo "    set \$edge_module edge;"
        echo "    include /etc/nginx/snippets/attente.conf;"
        echo "    include $NGINX_ENVSUBST_OUTPUT_DIR/lan/$module.conf;"
        echo "}"
    } >> "$sortie"
done

echo "cfao-edge: écoutes LAN : ${entrees:-aucune}"
