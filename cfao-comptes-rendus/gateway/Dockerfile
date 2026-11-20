# Passerelle du module : construit l'interface (web/) puis la sert avec nginx,
# qui route /apercu et /cr-donnees vers l'API.
# Contexte de build : cfao-comptes-rendus/ (voir docker-compose.yml).

# 22.23.4 : correctif CVE-2026-111497. Étape de build seulement ; l'image servie est nginx.
FROM node:22.23.4-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# Préfixe de service, le même que la route de cfao-edge (nginx.conf le suppose).
ENV CR_BASE=/cr/
# Adresse du portail (accueil formateur) : le port du portail sur l'IP du serveur par défaut ;
# `--build-arg PORTAIL_URL=...` pour une autre (ex. l'adresse publique).
ARG PORTAIL_URL=https://192.168.10.155:8446/
ENV VITE_PORTAIL_URL=$PORTAIL_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /web/dist /usr/share/nginx/html/cr
EXPOSE 80

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
