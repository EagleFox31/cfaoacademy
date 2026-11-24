# Image de production du portail : compile le front (Vite) puis le sert avec nginx.
# Contexte de build : frontend/, depuis un worktree propre (public/assets y est un
# vrai dossier, alors que sur le poste c'est une jonction).
# Aucun hôte figé : /config.js est écrit au démarrage (entrypoint.d/15-config.sh).

FROM node:22.23.4-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
# Écrite dans dist/version.json et dans le code : un onglet ouvert compare les deux.
ARG VERSION=
RUN npm run build

# Non privilégié : tourne en lecture seule (read_only + tmpfs /tmp), écoute 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="CFAO Academy Portail" \
      org.opencontainers.image.description="Portail par rôle de CFAO Academy (SPA servie par nginx)"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 entrypoint.d/15-config.sh /docker-entrypoint.d/
COPY --from=web /web/dist /usr/share/nginx/html
EXPOSE 8080

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
