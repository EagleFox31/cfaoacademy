# CFAO Academy — Backend (nœud A : Infra + CI)

Squelette du socle plateforme. Matérialise la stack validée : **Keycloak** (authN) ·
**Cerbos** (authZ) · **Django/DRF** (`cfao-core`) · **Node/TS** (`cfao-operations`) ·
**PostgreSQL** · **gateway** nginx (+ BFF oauth2-proxy à venir). Voir `architecture.md`.

> ⚠️ Squelette de démarrage (nœud **A** du PERT). Le realm Keycloak (`00-6`) et le BFF
> ne sont pas encore provisionnés — voir « Prochaines étapes ».

## Arborescence

```
docker-compose.yml          # keycloak, cerbos, core, operations, 2× postgres, gateway
.env.example                # forme des variables (aucun secret)
gateway/nginx.conf          # reverse proxy /api/v1/core, /api/v1/ops
cerbos/                     # PDP : config + policies + tests (default-deny)
cfao-core/                  # Django : couche core/ (auth+authz) + endpoint /me de référence
cfao-operations/            # Node : middleware auth+authz + /health + /me de référence
.github/workflows/ci.yml    # cerbos compile --tests · pytest · node build · secret scan
```

## Démarrer en local

```bash
cp .env.example .env        # ajuster les mots de passe de dev
docker compose up --build
```

- Gateway : http://localhost:8000 (`/healthz`, `/api/v1/core/...`, `/api/v1/ops/...`)
- Keycloak : http://localhost:8080  · Cerbos : http://localhost:3592

**Itération dev sans rebuild.** `docker-compose.override.yml` (chargé automatiquement) **bind-monte
le code** → `runserver` (Django) et `tsx watch` (Node) **rechargent à chaud**. On édite, ça reflète
en direct. Rebuild (`--build`) seulement si les **dépendances** changent ; nouvelles **migrations** :
`docker compose exec core python manage.py migrate` ; nouvelle/maj **policy Cerbos** :
`docker compose restart cerbos` (hot-reload bind mount peu fiable sous Windows).

## Tests (la séquence du projet : TU → TI → contrat → E2E)

```bash
# Policies Cerbos (inclut les tests NÉGATIFS d'autorisation)
docker run --rm -v "$PWD/cerbos:/cerbos" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/cerbos/tests /cerbos/policies

# cfao-core (pytest, SQLite en mémoire — pas besoin de Postgres)
cd cfao-core && pip install -r requirements.txt && pytest

# cfao-operations
cd cfao-operations && npm install && npm run typecheck && npm run build
```

## Le patron sécurisé (à recopier par le générateur de module)

`GET /api/v1/core/me` traverse toute la chaîne et sert de **gabarit** :

```
JWT Keycloak (JWKS)  →  build_principal()  →  CerbosPermission (default-deny)
   core/auth/oidc.py      core/auth/principal.py    core/authz/permissions.py → cerbos.py
```

Règles encodées dans le squelette (OWASP A01 / ASVS) :
- **PEP Cerbos sur chaque endpoint** ; pas de `cerbos_resource_kind` ⇒ accès refusé.
- **Fail-closed** : PDP indisponible ⇒ refus.
- **Tests négatifs d'autorisation** obligatoires (`cerbos/tests`, `identity/tests/test_me.py`).
- **Aucun secret dans le dépôt** (`.env.example` seulement) + secret scanning en CI.

## Realm Keycloak — config-as-code (story 00-6 ✅)

Le realm `cfao` est **versionné** dans `keycloak/config/cfao-realm.yaml` et appliqué par
`keycloak-config-cli` (service one-shot du compose : idempotent, sans redémarrage, détection
de dérive). Aucune configuration manuelle dans la console.

Contenu : les **22 rôles** plateforme, deux **clients** (`cfao-portal` confidentiel pour le
BFF, `cfao-spa` public PKCE pour le dev), un **client scope `cfao-scope`** qui injecte les
claims de périmètre (`scopeNode`, `departments`, `brands`, `orgPath` — consommés par
`build_principal`), les **IdP upstream Google/Microsoft** (désactivés tant que sans secrets),
et des **users de démo** (mot de passe `demo`).

```bash
# Appliqué automatiquement au `docker compose up`. Réappliquer après modif du YAML :
docker compose up keycloak-config-cli
# Obtenir un token de dev (client public PKCE) puis tester la chaîne /me :
#   réaliser le flow sur http://localhost:8080/realms/cfao  (client cfao-spa)
#   puis : curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/core/me
```

Secrets (`OAUTH2_PROXY_CLIENT_SECRET`, `GOOGLE_*`, `MS_*`) injectés via `$(env:VAR)` — jamais
dans le YAML. Le BFF (`gateway/oauth2-proxy.cfg`) est prêt : décommenter le service
`oauth2-proxy` dans `docker-compose.yml` après avoir généré `OAUTH2_PROXY_COOKIE_SECRET`.

## Validation live (testé via `docker compose up`)

Chaîne d'auth vérifiée de bout en bout, **les deux services** :

| Cas | Résultat |
|-----|----------|
| Token Keycloak valide → `GET /api/v1/core/me` (Django) | **200** + principal résolu (id, rôles, scopeNode, departments, brands, orgPath) |
| Token valide → `GET /api/v1/ops/me` (Node) | **200** + principal |
| Token invalide / absent | **401** |
| `GET /api/v1/ops/health` (public) | **200** |

Le 200 prouve que **Cerbos répond ALLOW** (sinon fail-closed → 403). Tests : Cerbos **7 OK**, pytest **3 OK**, Node build OK.

**Pièges Keycloak 24+ rencontrés et corrigés (config realm) :**
- Image `keycloak-config-cli` **épinglée** sur le build KC 25 (`latest-25.0.1`) — `latest` ciblait un KC plus récent (HTTP 400).
- Chaque protocol mapper doit porter `protocol: openid-connect` (sinon NPE 500 à la création du client scope).
- Le claim **`sub`** vient du client scope **`basic`** : si on déclare `defaultClientScopes` explicitement, **réinclure `basic`**.
- Les **attributs personnalisés** (`scopeNode`…) sont rejetés sauf s'ils sont **déclarés dans le user profile** (composant `declarative-user-profile`, `unmanagedAttributePolicy: ENABLED`).

**Hygiène ressources & santé (DevOps) :**
- **Limites CPU + mémoire** sur chaque conteneur (`deploy.resources.limits`), **paramétrables par variables** `CPU_*` / `MEM_*` (défauts dev dans `.env.example`) — multi-env sans hardcode ; l'hôte dev (2 vCPU / ~3,7 Go) ne peut plus être saturé ; la JVM Keycloak est bornée (`MaxRAMPercentage=70`) pour éviter l'OOM kill. **Prod : le dimensionnement vit dans l'IaC (ACA), pas dans ce compose.**
- **Healthchecks** : `core` (`/api/v1/core/healthz`), `operations` (sonde `node`), `cerbos`, 3× Postgres. Le `gateway` ne démarre qu'après `core` **et** `operations` **sains** (`depends_on: service_healthy`).
- **Restart policies** : `unless-stopped` pour les services longs (récupération après reboot/incident) ; `on-failure` pour le job one-shot `keycloak-config-cli` (retente si erreur, s'arrête au succès).

## Usine à apps — générateur de module (étape 2 ✅)

`scripts/new_module.py` scaffolde un module Django **sécurisé par défaut** à partir du patron
`/me`, plus sa policy Cerbos et ses tests (dont les **tests négatifs d'autorisation**), et câble
`INSTALLED_APPS` + `config/urls.py` (idempotent).

```bash
# Aperçu sans rien écrire (compile les gabarits, valide les YAML) :
python scripts/new_module.py catalog Course --dry-run

# Génération réelle :
python scripts/new_module.py catalog Course
cd cfao-core && python manage.py makemigrations catalog && python manage.py migrate && pytest catalog
```

Ce que chaque module hérite automatiquement (briques `core/`) :
- `ScopedModel` (périmètre 3D : `org_path` / `department` / `brand`) — `core/models.py` ;
- `ScopedCerbosViewSet` — PEP Cerbos default-deny, check objet, **liste filtrée par query plan**
  (fail-closed) — `core/authz/viewsets.py` ;
- policy Cerbos `default-deny` + tests positif/négatif générés ;
- test Django : liste anonyme refusée, liste filtrée par le plan, fail-closed si plan refusé.

Ancres de câblage (ne pas retirer) : `# <generated-apps>` dans `config/settings/base.py`,
`# <generated-routes>` dans `config/urls.py`.

## Prochaine étape

**Nœud B (Identity)** — première vraie app produite par l'usine : arbre org, comptes,
`role_assignment`. Les 22 rôles existent déjà dans le realm Keycloak (00-6).

