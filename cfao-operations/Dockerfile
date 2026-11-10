# 22.23.4 : correctif CVE-2026-111497 (décodeur Brotli). Node 20 n'est plus corrigé.
FROM node:22.23.4-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
