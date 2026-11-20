# Plan : mise en ligne du portail du centre de formation (19/11/2026)

Objectif : portail (front `frontend/`) + API planning + API cfao-core sur le serveur Academy,
en images Docker Hub, derrière cfao-edge. La recette 8088 sert de preuve fonctionnelle.

## Choix retenus
- Origine propre au portail : second partage zrok `academy-portail` -> nouvelle écoute edge
  `127.0.0.1:8087` (mécanisme `EDGE_LAN`, `portail@127.0.0.1:8087`). `/` d'academy-server reste à needs.
  Raison : les deux SPA utilisent `/`, `/callback`, `/assets/` ; un préfixe obligerait à
  reprendre ~460 chemins absolus du front.
- Rien de propre à l'hôte figé au build : `/config.js` écrit au démarrage
  (`window.__PORTAIL_CONFIG__` : oidcIssuer, oidcClientId, crUrl, medacapUrl, keycloakSeul).
- Émetteur unique : `https://academy-server.shares.zrok.io/auth/realms/cfao`.
- Client Keycloak dédié `cfao-portail-web` (public, PKCE, audiences core + planning) ; `cfao-spa` reste désactivé en prod.

## Images
`cfao-portail:v0.1.0`, `cfao-planning-api:v0.1.0`, `cfao-core-api:v0.1.0`, `cfao-cerbos:v0.2.0`,
`cfao-keycloak:v0.5.0`, `cfao-edge:v0.3.0`, (`cfao-needs-api:v0.2.1` si `relay_needs_snapshot` absent de v0.2.0).

## Fichiers
- Créer : `frontend/{Dockerfile,nginx.conf,entrypoint.d/15-config.sh,.dockerignore,compose.prod.yml,env.prod.example,public/config.js}`,
  `frontend/src/lib/configExecution.js` ; `cfao-planning/{docker-compose.prod.yml,env.prod.example}` ;
  `cfao-core/{docker-compose.prod.yml,env.prod.example,.dockerignore}` ; `cerbos/compose.prod.yml` ;
  `edge/templates/lan/portail.conf.template` ; notice `docs/exploitation/`.
- Modifier : `frontend/src/lib/auth.js` (émetteur, client, `connexionKeycloakSeule`),
  `RedirectionExterne.jsx`, `utils/medacapConfig.js`, `index.html` (+ tests) ;
  `edge/compose.prod.yml`, `edge/.env.prod.example`, `edge/compose.dev.yml`, `edge/tests` ;
  `keycloak/config/cfao-realm.yaml` (client), `keycloak/compose.prod.yml` (job config :
  `CFAO_PORTAIL_WEB_REDIRECT_URIS`), `keycloak/.env.prod.example`, `keycloak/tests` ;
  `cfao-needs/docker-compose.prod.yml` (clés analytics/snapshot, `PLANNING_API_URL`, service `needs-relay`) ;
  `cfao-planning/api/core/auth/identity.py` (rattachement `Trainer.keycloak_sub` par e-mail, sans écrasement).

## Compose de prod (patron cfao-needs)
- `cerbos/compose.prod.yml` : projet `cfao-pdp`, service `cerbos`, réseau `cfao-maillage`, aucun port.
- planning : `planning-db`, `planning-migrate` (migrate, seed_referential, seed_cost_key, sync_needs_snapshot),
  `planning-api` (127.0.0.1:8005), réseaux default + cfao-maillage + identite.
  Secrets : `PLANNING_DB_PASSWORD`, `PLANNING_SECRET_KEY`, `NEEDS_ANALYTICS_KEY`, `NEEDS_SNAPSHOT_INBOUND_KEY` (`:?`).
- core : `core-db`, `core-migrate`, `core-api` (gunicorn, 127.0.0.1:8006).
  Secrets : `DJANGO_SECRET_KEY`, `CORE_DB_PASSWORD`, `NEEDS_ANALYTICS_KEY`, `MEDACAP_MONGO_URI`. Jamais `KEYCLOAK_ADMIN*`.
- portail : read_only, tmpfs /tmp, cap_drop ALL, 127.0.0.1:8095.

## Ordre sur le serveur (heure creuse)
1. Sauvegardes keycloak-db + needs-db ; ports 8005/8006/8087/8095 libres ; relais needs présent ; Mongo MEDACAP joignable.
2. cfao-pdp up. 3. identity v0.5.0 + redirections. 4. needs (clés + relais). 5. planning. 6. core.
7. portail. 8. edge v0.3.0. 9. zrok `academy-portail` (essai sur un nom jetable d'abord, watchdog).
10. Comptes du centre + première connexion de chaque profil.

## Contrôles
Portail 200 et `/config.js` correct ; healthz planning/core via portail ; `/api/v1/planning/internal/x` 404 ;
`/auth/realms/master` 404 ; `/me` avec jeton réel ; cartes Besoins du directeur non nulles ;
second `up` sans écriture ; connexion needs intacte.

## Retour arrière
edge v0.2.0 (variables vidées) ; release du partage zrok ; `down` portail/core/planning/pdp (volumes gardés) ;
compose needs précédent ; identity v0.4.0.

## Décisions ouvertes (utilisateur)
- Second nom zrok possible sur le compte ? (sinon portail à la racine, needs déplacé)
- MEDACAP (Mongo 10.68.0.7, URL) joignable depuis le serveur ?
- Données planning : base neuve + référentiel, ou reprise de la recette ?
- Liste des comptes du centre (rôle, mail) ; connexion par code mail ou mot de passe temporaire.
- Vidéos des articles (non versionnées) : volume serveur ou retrait.
- `/api/v1/planning/` et `/api/v1/core/` aussi joignables sur academy-server : accepté ?
