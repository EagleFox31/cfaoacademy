# Passerelle commune de la plateforme (cfao-edge) : un seul point d'entrée public
# (le partage zrok `academy-server`) routé par chemin vers les modules.
#   /auth/ -> Keycloak commun   /cr/ -> comptes rendus   / -> needs (inchangé)
# Une route de module n'existe que si son adresse est renseignée (EDGE_*_UPSTREAM).
# Contexte de build : edge/.
FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG VERSION=dev
LABEL org.opencontainers.image.title="CFAO Edge" \
      org.opencontainers.image.description="Passerelle commune de la plateforme, routage par chemin" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="${VERSION}"
# Modèles rendus dans /tmp (système de fichiers en lecture seule). Seules les
# variables EDGE_* sont substituées : $host, $uri… restent des variables nginx.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/conf.d NGINX_ENVSUBST_FILTER=^EDGE_
COPY nginx.conf /etc/nginx/nginx.conf
COPY snippets/ /etc/nginx/snippets/
COPY templates/ /etc/nginx/templates/
# Le bit exécutable ne survit pas à un poste Windows : il est posé ici.
COPY --chmod=0755 entrypoint.d/ /docker-entrypoint.d/
