#!/bin/sh
# Après le rendu des modèles : un module sans adresse n'a pas de route, son
# préfixe retombe sur needs comme avant la passerelle (retour arrière).
set -eu

routes="$NGINX_ENVSUBST_OUTPUT_DIR/routes"

if [ -z "${EDGE_KEYCLOAK_UPSTREAM:-}" ]; then
    rm -f "$routes/auth.conf"
fi
if [ -z "${EDGE_CR_UPSTREAM:-}" ]; then
    rm -f "$routes/cr.conf"
fi

echo "cfao-edge: modules actifs : $(ls "$routes" 2>/dev/null | tr '\n' ' ')needs"
