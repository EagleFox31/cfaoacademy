# cfao-supervision — cockpit d'exploitation

Écran réservé à l'équipe d'exploitation (rôle realm `platform_ops`) et à l'équipe
technique (`superadmin`). Il répond à quatre questions :

- quels modules tournent, lesquels sont arrêtés, depuis quand ;
- quelle version est installée, avec quelles nouveautés, et quand elle a été mise à jour ;
- sur quels ports, et quels modules chacun utilise ou fournit ;
- quand un utilisateur s'est connecté pour la dernière fois, et dans quel module.

Le module **lit** l'état des autres ; il n'agit sur aucun.

## Composants

| Service | Rôle |
|---|---|
| `supervision-db` | PostgreSQL 16 : référentiel des modules, conteneurs, événements, connexions. |
| `supervision-migrate` | Job ponctuel : migrations puis `bootstrap` (modules absents seulement). |
| `supervision-api` | API de lecture `/api/v1/supervision/` (jeton Keycloak + Cerbos). |
| `supervision-collector` | `manage.py collect` : Docker toutes les 15 s, journal de l'edge toutes les 30 s, connexions Keycloak toutes les 60 s, purge. |
| `supervision-socket` | `wollomatic/socket-proxy` : quelques lectures Docker autorisées, réseau sans sortie, seul le collecteur y accède. |

## Ce qui n'est jamais stocké ni affiché

Identifiants Docker, identifiants d'image, `sub` Keycloak, adresses IP. Une connexion
nominative est oubliée après 90 jours sans activité (`SUPERVISION_ACCESS_RETENTION_DAYS`).

## Poste de développement (recette 8088)

```sh
cp cfao-supervision/.env.example cfao-supervision/.env   # puis remplir les secrets
docker compose -f cfao-supervision/docker-compose.yml up -d --build
curl -s http://127.0.0.1:8007/api/v1/supervision/healthz
```

Tests : `cd cfao-supervision/api && .venv/Scripts/python.exe -m pytest -q`.

## Production

Voir [MISE_A_JOUR.md](MISE_A_JOUR.md) (installation et mise à jour sur le serveur) et
[PUBLIER_IMAGES.md](PUBLIER_IMAGES.md) (construction de l'image). Nouveautés par
version : [CHANGELOG.md](CHANGELOG.md).

## Ajouter un module à la supervision

1. Ajouter son projet compose à `SUPERVISION_PROJECTS` (liste blanche, seule source).
2. Ajouter sa ligne dans `api/supervision/inventory/modules.json` : le prochain `up`
   la crée, sans toucher aux lignes existantes.
