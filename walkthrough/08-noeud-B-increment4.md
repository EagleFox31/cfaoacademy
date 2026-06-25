# 08 — Nœud B · incrément 4 : endpoints /users scopés (TDD + live)

## Contexte
Exposer les comptes en API **scopée**. Difficulté : un compte n'est pas une unité org ;
son périmètre = **union des chemins de ses affectations**. On dénormalise ça sur `User`.

## État avant
- Endpoints `/org/units` (inc.2/3). `User` sans champ de périmètre exploitable en liste.

## Tests exécutés (écrits AVANT)
```bash
.venv/Scripts/python -m pytest -q                # 32 passed
docker run ... cerbos compile --tests ...        # 21 OK (account, org_unit, user_account)
# live : rebuild core + seed + /users via gateway (2 personas)
```
Cas : `recompute_scope_paths` (union) ; liste anonyme refusée ; liste filtrée par query plan
(allowed→2, denied→vide) ; **retrieve hors-scope→403** ; **create par learner→403**.
Cerbos : admin view/update in-scope ALLOW ; **hors-scope DENY** ; **learner create/update/delete DENY**.

## Erreurs rencontrées
1. **Rouge attendu** : champ/méthode/endpoint/policy absents.
2. **Live : /users renvoyait 0 pour tous** (même `group_admin`). Debug : le plan Cerbos
   `user_account/list` renvoyait `KIND_ALWAYS_DENIED` alors que `scope_paths` était correct.
   **Cause** : Cerbos **n'avait pas rechargé** `user_account.yaml` (ajoutée après son démarrage) —
   le **file-watching sur bind mount Windows (Docker Desktop) n'est pas fiable**. Sans policy → default-deny.
   **Fix** : `docker compose restart cerbos`.

## Modifications
- `identity/models.py` : `User.scope_paths` (JSON, dénormalisé) + `recompute_scope_paths()`
  (union des `path` des affectations actives). Migration `0002`.
- `identity/views.py` : `UserViewSet` (kind `user_account`, objet via `scope_paths`, liste via query plan).
- `identity/serializers.py` : `UserSerializer`. `identity/urls.py` : route `users`.
- `cerbos/policies/resource_policies/user_account.yaml` (+ `user_account_test.yaml`).
- `seed_dev.py` : appelle `recompute_scope_paths()` après les affectations.

## Résultat final
- **pytest 32 passed** (26 + 6) ; **Cerbos 21 OK** (7 + 7 + 7).
- **Live `/users`** : `aminata.kone` (filiale CIV) → **2** (`aminata.kone`, `kouame.assi`) ;
  `moa.pilotage` (groupe) → **9** (tous). Filtrage `scope_paths CONTIENT scopeNode` validé sur Postgres réel.

## Périmètre couvert
- `/users` CRUD scopé : objet via Cerbos, liste via query plan sur `scope_paths` dénormalisé.
- Négatifs (hors-scope 403, élévation learner 403) côté Django **et** policy Cerbos.
- Dénormalisation périmètre testée en unitaire **et** live.

## Périmètre NON couvert (→ suite)
- **`/users/{id}/assignments`** (créer/retirer une affectation + recompute) — pas encore exposé.
- **Multi-scope** : checks Cerbos via `scopeNode` singulier du token (pas `scopeNodes`).
- **Recompute auto** sur changement d'affectation (signal) — aujourd'hui manuel/au seed.
- Provisioning-on-login, contrat Keycloak, E2E.

## Gotcha à retenir (dev Windows)
Après **ajout/modif d'une policy Cerbos**, `docker compose restart cerbos` — ne pas se fier au
hot-reload sur bind mount Windows. (En CI/Linux le watch fonctionne ; `cerbos compile --tests` reste la vérité.)
