# Plan — module cfao-supervision (cockpit d'exploitation)

Objectif : voir à tout moment, par module et par conteneur, l'état (en service / en panne depuis),
la version, les nouveautés, les ports, la date de mise à jour, les liens entre modules et la
dernière connexion nominative d'un utilisateur.

## Décisions
- Module séparé `cfao-supervision/` copié de `template-service/` (auth/oidc, cerbos, settings prod,
  gunicorn, healthz repris de cfao-planning ; `jwt_verifier.py` = copie identique de cfao-core).
- Policies dans le PDP unique `cerbos/` (pas de bundle de module, CI l'interdit).
- Rôle realm `platform_ops` (+ `superadmin`). Ressources Cerbos `supervision_board`, `supervision_connections`.
- Docker lu par le seul collecteur via `wollomatic/socket-proxy` (liste blanche GET : _ping, version,
  info, containers/json, containers/<id>/json, logs du seul conteneur edge), réseau `internal`.
- Version = tag d'image ; label `org.opencontainers.image.version` affiché s'il diffère.
- Nouveautés = label `org.cfao.changelog` (section `[x.y.z]` du CHANGELOG.md du module, ≤ 4000 car.),
  posé par `scripts/build_image.py`. Label absent (images publiées avant le 19/11) : l'écran
  affiche « Nouveautés non renseignées pour cette version », jamais un bloc vide (i18n fr/en/pt).
- Date de construction = date du commit (builds reproductibles) ; un tag déjà sur Docker Hub
  est refusé par le script sauf `--force`.
- Connexion nominative : événements LOGIN Keycloak (compte de service `view-events`, rétention 7 j)
  + `sub` du jeton journalisé par l'edge (njs, aucun autre champ) → « Dernière activité ».
  Aucune IP stockée ; purge après 90 j d'inactivité.
- Front : `/portail/supervision` dans `frontend/`, coquille `AppShell` (cockpit), i18n fr/en/pt.

## Faits serveur (19/11/2026)
- Projets compose prod : cfao-edge, cfao-portail, cfao-core, cfao-needs, cfao-identity,
  cfao-compte-rendus (singulier), cfao-planning (+ academix, whoami, non CFAO à exclure).
- GID du socket Docker : 988. Port 8097 libre. njs présent dans l'image edge.
- Recette locale : edge = `cfao-recette-edge-1` (8088), keycloak `cfao-recette-keycloak-1`.

## Étapes (chacune avec sa preuve)
1. Keycloak : rôle, events LOGIN 7 j, clients `cfao-supervision-api` / `-collector`, scope d'audience ; tests realm.
2. Cerbos : 2 policies + tests positifs/négatifs ; `cerbos compile --tests`.
3. Squelette `cfao-supervision/api` ; pytest ; healthz sur base vide.
4. Modèles Module, Container, ContainerEvent, CollectRun, KnownUser, UserModuleAccess.
5. Collecteurs docker / edge_logs / keycloak_events / retention + verrou advisory.
6. API lecture : access, overview, modules, modules/<p>, history, dependencies, connections.
7. Compose dev (8007) et prod (8097) ; preuves §7 (base vide, 2e up = 0 écriture).
8. Edge : njs `sub`, route `/api/v1/supervision/`, tests edge.
9. `scripts/build_image.py` + CHANGELOG.md par module + Dockerfiles `ARG VERSION`.
10. Front : écrans, statuts, i18n, routes, menu ; vitest + build.
11. CI + docs exploitation.
12. Recette 8088 puis prod (identity → PDP → core → supervision → edge → portail).
