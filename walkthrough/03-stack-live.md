# 03 — Stack live (`docker compose`) : auth bout-en-bout

## Contexte
Monter toute la stack et valider la **vraie** chaîne d'authentification/autorisation
(Keycloak → JWKS → service → Cerbos), les deux services, via le gateway.

## État avant
- `docker compose` jamais lancé. Realm Keycloak en config-as-code (`keycloak/config/cfao-realm.yaml`) jamais appliqué. Aucune validation runtime de l'intégration.

## Tests exécutés
```bash
cp .env.example .env
docker compose up -d --build          # 9 services
docker compose up -d keycloak-config-cli   # applique le realm (itératif)

# Test d'auth depuis le conteneur core (issuer keycloak:8080 == ce que core valide)
docker compose exec -T core sh -c '
 TOKEN=$(curl -s -X POST http://keycloak:8080/realms/cfao/protocol/openid-connect/token \
   -d grant_type=password -d client_id=cfao-spa -d username=kouame.assi -d password=demo -d scope=openid \
   | sed -n "s/.*\"access_token\":\"\([^\"]*\)\".*/\1/p")
 curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" http://gateway/api/v1/core/me
 curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" http://gateway/api/v1/ops/me
 curl -s -w "%{http_code}" -H "Authorization: Bearer bad"   http://gateway/api/v1/core/me
'
```

## Erreurs rencontrées (5, dans l'ordre)
1. **Substitution `$(env:VAR)`** non résolue par keycloak-config-cli → `Cannot resolve variable`. 
2. **Image `keycloak-config-cli:latest` incompatible KC 25** → `HTTP 400 "unable to read contents from stream"` à la création du realm.
3. **Protocol mapper sans `protocol`** → Keycloak **HTTP 500 NullPointerException** (`ProtocolMapperEntity.getProtocol()` null) à la création du client scope.
4. **Token valide → 401 « missing sub claim »** : en KC 24+, le claim `sub` est porté par le client scope **`basic`** ; en déclarant `defaultClientScopes` explicitement, `basic` avait été perdu.
5. **`scopeNode` (et autres attributs) absents du token** : KC 24+ **rejette les attributs non déclarés** (user profile).

## Modifications
- `docker-compose.yml` : image `adorsys/keycloak-config-cli:latest-25.0.1` (épinglée KC 25) ; `IMPORT_VARSUBSTITUTION_ENABLED: "false"`.
- `cfao-realm.yaml` :
  - secrets remplacés par des **valeurs dev littérales** (`dev-portal-secret`, IdP `set-in-prod`) — prod via Key Vault ;
  - `protocol: openid-connect` ajouté à chaque protocol mapper ;
  - **`basic`** réintégré aux `defaultClientScopes` des deux clients ;
  - **user profile déclaratif** (`declarative-user-profile`) déclarant `scopeNode/departments/brands/orgPath` + `unmanagedAttributePolicy: ENABLED`.

## Résultat final
| Test | HTTP | Corps |
|------|------|-------|
| `GET /api/v1/core/me` (Django) + token valide | **200** | principal complet : id (sub), roles `[learner]`, scopeNode, departments `[motors]`, brands `[toyota]`, orgPath |
| `GET /api/v1/ops/me` (Node) + token valide (`loic.traore`, Equipment) | **200** | principal : departments `[equipment]`, marques PL |
| token invalide / absent | **401** | erreur normalisée |
| `GET /api/v1/ops/health` (public) | **200** | `{"status":"ok"}` |

Le **200 prouve que Cerbos répond ALLOW** (sinon fail-closed → 403) — le PDP est bien dans la boucle.

## Périmètre couvert (live)
- **Realm en config-as-code** appliqué par keycloak-config-cli (idempotent).
- **Émission JWT** Keycloak avec claims custom + résolution **claims → principal**.
- **Routing gateway** vers les deux services (`/core`, `/ops`).
- **Validation JWT via JWKS** côté Django (PyJWT) **et** Node (jose), incl. `issuer`.
- **PEP → Cerbos (ALLOW)** sur `account/view:self`, les deux services.
- **Cas négatifs 401** (token invalide / absent).

## Périmètre NON couvert (live)
- **Cerbos DENY live** via un endpoint réel (cross-scope) — seul `view:self` (toujours ALLOW pour soi) est testé live ; le DENY n'est prouvé qu'en **tests de policy** (fiche 01/02).
- **Autorisation au niveau objet et liste** sur une vraie ressource métier (pas encore de modèle exposé hors `/me`).
- **BFF oauth2-proxy** (flow OIDC navigateur + cookie httpOnly) — service laissé commenté.
- **Tests de contrat** (Pact/schemathesis), **E2E UI** (Playwright), **unitaires Node** (vitest).
- **Refresh tokens**, expiration, rotation de clés.
- **Config prod** (secrets via Key Vault, TLS, `cookie_secure`), **perf/charge**.
- **Smoke `00-7`** (1 compte par rôle) — partiellement amorcé (2 users testés sur 9).
