FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="CFAO Needs Gateway" \
      org.opencontainers.image.description="Passerelle Nginx et frontend SPA pour CFAO Needs" \
      org.opencontainers.image.vendor="CFAO Mobility"

COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 gateway/entrypoint.d/15-config-oidc.sh /docker-entrypoint.d/
COPY web/dist /usr/share/nginx/html

EXPOSE 80

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
