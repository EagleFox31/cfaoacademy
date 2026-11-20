# 22.23.4 : correctif CVE-2026-111497 (décodeur Brotli). Node 20 n'est plus corrigé.
FROM node:22.23.4-slim

WORKDIR /app

# Lockfile respecté (npm ci), dépendances de dev retirées après la compilation.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# Sans root : l'API n'écrit nulle part dans /app, elle ne fait que lire son code.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin service
USER 10001

EXPOSE 3000
CMD ["node", "dist/server.js"]

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
