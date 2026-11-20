# Plan : une adresse, applications par chemin (19/11)

Décision utilisateur : `/` landing (front), `/portail/…` (même front), `/besoins/…` needs, `/cr/…`, `/auth/…`. Même découpage en recette 8088 et sur le serveur. Caddy (IP) et zrok ne visent qu'edge (8086).

## Principes
- `/besoins/` garde son préfixe de bout en bout (un proxy ne retire jamais un préfixe). L'API needs reste `/api/v1/needs/`.
- URL vue du navigateur : liste blanche d'origines `EDGE_ORIGINES` (map sur X-Forwarded-Host / Host). Inconnue = origine canonique zrok. Le schéma vient de la liste, jamais de X-Forwarded-Proto.
- Keycloak phase 1 : `KC_HOSTNAME` reste sur zrok (connexion depuis l'IP = passage par Internet) ; on ajoute les URI exactes de l'IP aux clients. Phase 2 (hostname dynamique) seulement si une connexion sans Internet est exigée.
- La retouche X-Forwarded des écoutes LAN (`lan/cr`, `lan/portail` + test `test_ecoutes_lan_suivent_le_proxy_https_devant`) devient inutile : à retirer, ne pas publier.

## Lots
- **L1 needs (gateway v0.4.0)** : `web/vite.config.js` base `/besoins/` ; `index.html` `%BASE_URL%` ; `main.jsx` basename ; `App.jsx:115-125` helper `cheminApp()` (`lib/base.js`, avec `asset()`) ; `lib/auth.js:31,270-273,316` ; chemins absolus (`lib/assets.js:20,65`, `AppShell.jsx:71`, `BrandLogo.jsx:46`, `PortalLoader.jsx:61,66`, `BrandEntry.jsx:24-25`, `fichePaths.js:49`, `MobileBottomNav.jsx:71`, vérifier `tokens.css:24`) ; `gateway/Dockerfile:10` → `/usr/share/nginx/html/besoins` ; `gateway/nginx.conf` : `absolute_redirect off`, `/besoins/config.js`, `/besoins/catalogues/`, `location /besoins/` + `try_files`, `index.html` en `expires -1`, `location / { return 308 /besoins$request_uri; }` ; compose dev `:213`, prod `:139` (v0.4.0) et `:70` `NEEDS_PUBLIC_BASE_URL=…/besoins`. Bug existant : `api/outbound/services/queue.py:152-154` produit `/campagnes/{année}/fiches/{id}`, route absente du SPA (needs-api v0.2.2). Pré-étape : gateway v0.3.1 avec seulement `expires -1` sur `index.html`, 1 à 2 jours avant (risque de page blanche par cache).
- **L2 edge (v0.4.0)** : `EDGE_ORIGINES` (validée dans `05-exiger-variables.sh`, regex `^https?://[A-Za-z0-9.-]+(:[0-9]+)?$`) ; nouveau `27-origines.sh` → `/tmp/conf.d/origines.conf` (maps) ; `edge.conf.template:30-32` lit `$edge_req_*` ; `:37` inclut `racine/*.conf` ; nouveau `racine/portail.conf.template` (`location /` → `EDGE_PORTAIL_UPSTREAM`) ; nouveau `routes/needs.conf.template` (`/besoins`, `/besoins/`, `/api/v1/needs/`, anciens liens `^/(marque/|relecture(/|$)|a-envoyer(/|$)|fiche/|campagnes/)` en 308 ; aucune redirection pour `/`, `/profil`, `/callback`, `/catalogues/`, `/assets/`, `/config.js`) ; `25-modules-actifs.sh` choisit racine portail ou needs ; `lan/portail` = redirection 301 vers l'origine publique (transition zrok `academy-portail`) ; `lan/needs` inclut `routes/needs` + 308. Ne pas toucher njs, `nginx.conf`, Dockerfile, supervision (session cfaoacademy-cf, à prévenir avant `test_edge_config.py`, `25-modules-actifs.sh`, `compose.*.yml`, `.env.prod.example`).
- **L3 front (cfao-portail v0.2.0)** : `entrypoint.d/15-config.sh:12-16` accepte un chemin `/…` pour cr, medacap, besoins ; `env.prod.example` `PORTAIL_CR_URL=/cr`, `PORTAIL_NEEDS_URL=/besoins` ; `RedirectionExterne.jsx:9` `new URL(adresse, origine)` + test ; test `urlBesoins` avec `/besoins`.
- **L4 Keycloak** : `keycloak/.env.prod.example:29,31` URI exactes zrok + IP (`/besoins/callback`, `/besoins/`, `/callback`, `/`), garder les anciennes pendant la bascule ; `cfao-realm.yaml:324` + `http://localhost:8088/besoins/*` ; tests keycloak ; job `config` (relancer avec `IMPORT_CACHE_ENABLED=false` si import ignoré).
- **L5 autres** : IP (avec port si ≠ 443) dans `ALLOWED_HOSTS` planning, core, supervision ; CR `ORIGINES_AUTORISEES` + `CR_BIND=127.0.0.1`.
- **L6 recette 8088** : `edge/compose.dev.yml:112-113` `EDGE_PORTAIL_UPSTREAM=host.docker.internal:5173`, `EDGE_NEEDS_UPSTREAM=host.docker.internal:8082` (needs intégré sur 8082) ; `frontend/compose.dev.yml:40` `VITE_NEEDS_URL=/besoins`.
- **L7 tests** : `test_edge_config.py` (liste blanche, needs reçoit `$edge_fwd_*`, origines 0/1/2, refus 05) ; `smoke_edge.py` (`/` portail, `/besoins/x`, `/marque/A` 308, X-Forwarded-Host forgé → canonique) ; stub portail dans `compose.smoke.yml`, variables CI `ci.yml:269-283,318-320` ; needs build + vitest + `nginx -t` + curl ; front vitest + build ; pytest keycloak.

## Caddyfile cible (question ouverte : Nextcloud)
- A (CFAO sur 443, Nextcloud déplacé en 8443 + `occ overwritehost`) : `https://IP` → 8086 ; `:8444` → 308 `/besoins{uri}` ; `:8445` → 308 `/cr{uri}` ; `http://IP:8092` → 308 `/cr`. `EDGE_ORIGINES=https://192.168.10.155`.
- B (Nextcloud garde 443) : `:8444` → 8086 ; `:8445` et `http://IP:8092` → 308 `:8444/cr{uri}`. `EDGE_ORIGINES=https://192.168.10.155:8444`.
- Avant de couper l'accès direct à l'API CR sur 8445 : lire les journaux Caddy.

## Ordre serveur
0. Sauvegardes (Caddyfile, `.env` de chaque module, tags en service), `compose config -q` après chaque `.env`.
1. Recette 8088 d'abord. Gateway v0.3.1 (cache), puis needs-gateway v0.4.0, edge v0.4.0, portail v0.2.0.
2. Ajouts sans coupure : URI Keycloak, ALLOWED_HOSTS, ORIGINES_AUTORISEES.
3. needs-gateway v0.4.0 (compatible edge v0.3.0), restart gateway, healthz.
4. Edge v0.4.0 + `EDGE_PORTAIL_UPSTREAM=127.0.0.1:8095` + `EDGE_ORIGINES`, portail v0.2.0 dans la même fenêtre, en heure creuse.
5. Caddy (sudo par l'utilisateur) : `cp` en `.bak-<date>`, `caddy validate`, `cp`, `systemctl reload caddy` ; puis `CR_BIND=127.0.0.1`.
6. zrok `academy-portail` → redirection jusqu'à une date fixée, puis libéré ; retirer les anciennes URI Keycloak.
7. Preuves curl (IP puis zrok), second `up -d` sans recréation, vraie connexion depuis un poste du LAN.
8. Retour arrière : `EDGE_PORTAIL_UPSTREAM=` vide, ou images v0.3.0 + `Caddyfile.bak` + ancien `.env` portail.

## Risques
- Ce que zrok envoie comme Host / X-Forwarded-Host (lire le journal edge).
- `tls internal` : `crypto.subtle` exige un contexte sûr ; diffuser la CA racine de Caddy si besoin.
- Cache de l'ancien index needs à `/`.
- Docs : `docs/exploitation/`, `MISE_A_JOUR`, entrée lessons-learned (« l'URL vue des navigateurs vient d'une liste blanche d'origines »).

## Ordre et preuves — L4 (Keycloak) et L5 (comptes rendus) (20/11, préparation, aucun geste serveur)
Origine unique `O` = `https://<hôte>[:<port>]` à fixer avant tout (IP de Caddy ou zrok) : seul point ouvert ; toutes les valeurs ci-dessous en dépendent.

Ordre (chaque étape : verrou `deploy:serveur`, `coord.py status` avant le geste, go de manitou, retour arrière prêt) :
1. **L4a Keycloak, ajout seul** : ajouter à `CFAO_NEEDS_REDIRECT_URIS` (`keycloak/.env.prod.example`) les URI exactes `O/besoins/callback` et `O/besoins/`, et à `CFAO_PORTAIL_WEB_REDIRECT_URIS` `O/callback` et `O/` ; garder les anciennes (zrok, `:8080`). Jamais de joker. Mise en place : job `config` (relancer avec `IMPORT_CACHE_ENABLED=false` si l'import est ignoré). Preuve : `kcadm get clients` (URI présentes, anciennes comprises) et un parcours de connexion sur l'ancienne adresse toujours vert.
2. **L5 CR** : `ORIGINES_AUTORISEES` (compose prod, `ORIGINES_AUTORISEES: ${…}`) reçoit `O` en plus des origines actuelles ; `ALLOWED_HOSTS` de l'API CR reçoit l'hôte de `O` ; `CR_BIND=127.0.0.1` seulement une fois edge devant. Preuve : POST `/cr-donnees/...` avec `Origin: O` accepté (≠ 403) et avec une origine inconnue refusé ; `cr-donnees/session` = 200 depuis `O/cr/`.
3. **Builds L1 (needs sous `/besoins/`, gateway v0.4.0) et L3 (portail v0.2.0)** : un tag par module, verrous `build:<module>`, go de manitou. Preuve : vitest + build verts, bundle sans chemin absolu `/…` hors base.
4. **L2 edge v0.4.0** en dernier : `EDGE_ORIGINES` contient `O`. Preuves : `test_edge_config.py` vert, `smoke_edge.py` (`/` portail, `/besoins/x`, `/cr/` 200, `/marque/A` 308, `X-Forwarded-Host` forgé → origine canonique), `nginx -t`.
5. **Parcours navigateur de test sur `O`** (connexion, accueil centre, `/besoins/`, `/cr/` sans boucle), puis seulement retirer les anciennes URI Keycloak, les ports 8444/8445/8446 et la retouche X-Forwarded des écoutes LAN.
Retour arrière : L4/L5 sont additifs (retirer la valeur ajoutée) ; L1/L3/L2 : tag précédent + `up -d` du seul module.
Bloquant : choix de `O` (utilisateur ou manitou).
