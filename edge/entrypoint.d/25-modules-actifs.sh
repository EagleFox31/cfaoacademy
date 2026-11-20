#!/bin/sh
# Après le rendu des modèles : un module sans adresse n'a pas de route, son
# préfixe retombe sur la racine (needs ou portail) comme avant la passerelle.
set -eu

routes="$NGINX_ENVSUBST_OUTPUT_DIR/routes"
racine="$NGINX_ENVSUBST_OUTPUT_DIR/racine"

if [ -z "${EDGE_KEYCLOAK_UPSTREAM:-}" ]; then
    rm -f "$routes/auth.conf"
fi
if [ -z "${EDGE_CR_UPSTREAM:-}" ]; then
    rm -f "$routes/cr.conf"
fi
if [ -z "${EDGE_PLANNING_UPSTREAM:-}" ]; then
    rm -f "$routes/planning.conf"
fi
if [ -z "${EDGE_CORE_UPSTREAM:-}" ]; then
    rm -f "$routes/core.conf"
fi
if [ -z "${EDGE_SUPERVISION_UPSTREAM:-}" ]; then
    rm -f "$routes/supervision.conf"
fi

# Racine de l'écoute publique (validée par 05). needs : relais à la racine,
# comme avant (retour arrière). portail : needs passe sous /besoins/.
if [ "${EDGE_RACINE:-needs}" = portail ]; then
    rm -f "$racine/needs.conf"
else
    rm -f "$racine/portail.conf" "$routes/needs.conf"
fi

echo "cfao-edge: modules actifs : $(ls "$routes" 2>/dev/null | tr '\n' ' ')racine ${EDGE_RACINE:-needs}"
