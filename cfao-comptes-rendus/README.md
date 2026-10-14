# Module « Comptes rendus formateur » (détachable)

Interface (`web/`), service (`api/`, Django + LibreOffice) et règles d'autorisation
(`cerbos/`) des comptes rendus de formation et de certification (story 04-5). Le dossier se
lance seul, sans rien emprunter au reste du dépôt ; décision : [ADR 0002](../docs/adr/0002-module-comptes-rendus-detachable.md).
Fonctionnement détaillé : [MODULE_RAPPORTS_FORMATEUR.md](../docs/MODULE_RAPPORTS_FORMATEUR.md).

```
cfao-comptes-rendus/
├── web/       SPA React + Vite (exceljs et jszip dans le navigateur)
├── api/       Django + DRF, rendu PPTX/PDF (LibreOffice), brouillons, Dockerfile
├── cerbos/    règles default-deny + tests
├── gateway/   nginx : sert web/ et route /apercu et /cr-donnees vers api/
└── docker-compose.yml   passerelle + api + PostgreSQL + Cerbos
```

## Démarrer en une commande

```bash
cd cfao-comptes-rendus
cp .env.example .env          # POSTGRES_PASSWORD, SECRET_KEY : à changer hors poste de dev
docker compose up --build -d  # ou : make up
```

Le module répond sur **http://localhost:8090** (variable `CR_PORT`). La passerelle est le seul
port publié (`127.0.0.1`) ; l'API, la base et Cerbos restent sur le réseau interne. Le portail
y renvoie via `VITE_CR_URL` (par défaut `http://localhost:8090`). Arrêt : `docker compose down`
(`-v` efface aussi la base et les photos).

## Modes d'authentification (`DEPLOYMENT_MODE`)

| Mode | Usage | Identité |
|---|---|---|
| `standalone` | poste de développement | profils fictifs de `api/profils-locaux.json`, **sans mot de passe** ; exige `DEBUG=True` |
| `local` | prod interne, sans Keycloak | identifiant + mot de passe ; exige `DEBUG=False`, une vraie `SECRET_KEY` et `COMPTES_LOCAUX` |
| `integrated` | dans la plateforme | jeton Keycloak de la plateforme (`OIDC_*`), jamais un realm propre |

### Mode local : créer un compte

Dans `.env` : `DEPLOYMENT_MODE=local`, `DEBUG=False`, `SECRET_KEY=<longue valeur aléatoire>`,
`COMPTES_LOCAUX=/donnees/comptes.sqlite3` (volume du service). Puis :

```bash
docker compose up -d
docker compose exec api python manage.py mot_de_passe <identifiant> [mot de passe]
```

Sans mot de passe, la commande en génère un et l'affiche une seule fois. L'identifiant doit
exister dans `PROFILS_LOCAUX` (par défaut les profils fictifs de l'image ; pour les vrais
formateurs, déposer un fichier JSON de même forme dans le volume `/donnees` et renseigner
`PROFILS_LOCAUX=/donnees/profils-locaux.json`). Cinq échecs consécutifs bloquent un identifiant
pendant une minute.

## Tests

```bash
cd web && npm ci && npm test                       # Vitest
cd api && pip install -r requirements-dev.txt && python -m pytest -q   # pytest (SQLite en mémoire)
make policy-test                                   # règles Cerbos (binaire local ou image Docker)
```

## Développement local (sans Docker pour l'interface)

```bash
cd api && python manage.py migrate && python manage.py runserver 127.0.0.1:5175   # mode standalone
cd web && npm ci && npm run dev        # http://localhost:5176
```

Le serveur Vite relaie `/apercu` et `/cr-donnees` vers `http://127.0.0.1:5175` ; la variable
`CR_SERVICE` vise une autre API (voir `web/.env.example`), par exemple la pile Docker
(`CR_SERVICE=http://127.0.0.1:8090 npm run dev`).

## Dans la plateforme

Le `docker-compose.yml` racine déclare le même service sous le nom `rapports` (mode
`integrated`, base SQLite sur son volume) : il construit `./cfao-comptes-rendus/api` et utilise
le Keycloak et la passerelle de la plateforme.
