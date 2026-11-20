# Installer ou mettre à jour la Supervision sur le serveur

Le serveur n'a pas le code source : il télécharge l'image depuis Docker Hub
(`antifragile237/cfao-supervision-api`). Les données (historique des états, dernières
connexions) sont conservées d'une version à l'autre.

Toutes les commandes se lancent dans `/srv/apps/cfao-supervision`. Raccourci :

```sh
dc() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
```

## Première installation

Ordre de la plateforme : `cfao-identity` (realm à jour) → PDP Cerbos → `cfao-core` →
**supervision** → `cfao-edge` → portail.

1. Copier `docker-compose.prod.yml` et `env.prod.example` depuis
   `\\192.168.10.155\partage\02_projets\cfao-supervision`.
2. Créer le `.env` à partir de `env.prod.example` (`chmod 600 .env`) :
   - `SUPERVISION_DB_PASSWORD`, `SUPERVISION_SECRET_KEY` : `openssl rand -base64 48` ;
   - `KEYCLOAK_COLLECTOR_SECRET` : la valeur de `CFAO_SUPERVISION_COLLECTOR_SECRET`
     dans le `.env` de `cfao-identity` ;
   - `DOCKER_GID` : résultat de `stat -c %g /var/run/docker.sock` (988 au 19/11/2026).
3. `dc pull && dc up -d`
4. Contrôler (voir plus bas).
5. Dans le `.env` de `cfao-edge` : `EDGE_SUPERVISION_UPSTREAM=127.0.0.1:8097`, puis
   relancer l'edge.
6. Dans Keycloak (realm `cfao`), donner le rôle `platform_ops` aux comptes de l'équipe
   d'exploitation.

## Mise à jour

1. `grep '^SUPERVISION_VERSION=' .env > version-precedente.txt`
2. Copier le nouveau `docker-compose.prod.yml` depuis le partage.
3. Mettre `SUPERVISION_VERSION` au nouveau tag dans `.env`.
4. `dc pull && dc up -d` : le job `supervision-migrate` applique les migrations
   manquantes et ajoute les modules absents, sans rien écraser.

Ne modifier **ni** `SUPERVISION_SECRET_KEY` **ni** `SUPERVISION_DB_PASSWORD` : la base a
été créée avec ce mot de passe.

## Contrôler

```sh
dc ps                                   # db, api, collector, socket : healthy ou running ; migrate : exited (0)
dc logs --tail 5 supervision-migrate    # « bootstrap : N module(s) ajouté(s) »
dc logs --tail 20 supervision-collector # aucune ligne « en échec »
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8097/api/v1/supervision/healthz   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8097/api/v1/supervision/overview  # 401 sans jeton
```

Dans le navigateur, avec un compte `platform_ops` : ouvrir **Supervision** depuis le
menu du compte. Tous les modules apparaissent ; arrêter puis relancer un module de test
doit se voir en moins de 30 s.

## Revenir à la version précédente

Remettre la valeur de `version-precedente.txt` dans `.env`, puis `dc up -d`. Les
migrations de la Supervision n'ajoutent que des tables ou des colonnes : l'ancienne
version les ignore.

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v0.1.0 | — | Première version (à installer). |
