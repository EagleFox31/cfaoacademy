# 01 — Nœud A : Cerbos, pytest core, build Node

## Contexte
Premier passage de tests **réels** sur le squelette du nœud A (infra + couche `core/`
sécurisée + endpoint `/me`), après l'avoir construit.

## État avant
- Scaffold A écrit : `docker-compose.yml`, `cfao-core/` (couche `core/auth` + `core/authz` + `/me`), `cfao-operations/`, `cerbos/`, CI.
- **Validé uniquement en statique** : `py_compile` (syntaxe Python), parse PyYAML, `npm run build` (frontend).
- **Jamais exécuté** : `pytest`, `cerbos compile`, `tsc` (Node), Docker.

## Tests exécutés
```bash
# 1) Policies Cerbos (compile + tests de policy)
docker run --rm -v "C:/.../cerbos:/work" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/work/tests /work/policies

# 2) cfao-core — venv DÉDIÉ (jamais en global)
python -m venv cfao-core/.venv
cfao-core/.venv/Scripts/python -m pip install Django==5.0.6 djangorestframework==3.15.1 \
  "PyJWT[crypto]"==2.8.0 requests==2.32.3 pytest==8.2.2 pytest-django==4.8.0 django-environ==0.11.2
cd cfao-core && .venv/Scripts/python -m pytest -q

# 3) cfao-operations
cd cfao-operations && npm install && npm run typecheck && npm run build
```

## Erreurs rencontrées
1. **Docker — mauvais point de montage.** `-v ...:/cerbos` écrase le binaire `/cerbos` de l'image → `not a directory`. 
2. **Cerbos — faille d'autorisation (test négatif rouge).** `update` sur un compte **hors périmètre** par un `branch_admin` → attendu `DENY`, obtenu `ALLOW`. Cause : dans une règle, `roles: [...]` **+** `derivedRoles: [...]` = **OU**, pas ET → tout `branch_admin` pouvait modifier n'importe quel compte.
3. **pytest — dépendance manquante dans le venv.** `ImportError: No module named 'environ'` (`django-environ` non installé).

## Modifications
- Montage Docker → `/work` (au lieu de `/cerbos`).
- `cerbos/policies/derived_roles/scope.yaml` : ajout du rôle dérivé **`admin_within_scope`** (parentRoles admins **ET** condition de scope).
- `cerbos/policies/resource_policies/account.yaml` : règle create/update → `derivedRoles: [admin_within_scope]` seul (plus de `roles:` en parallèle).
- `scripts/new_module.py` : **même correctif dans le gabarit** (sinon chaque module généré aurait hérité la faille).
- venv : installation de `django-environ`.

## Résultat final
- **Cerbos : 7/7 OK** (account : view:self, view/list scopé, create/update scopé + 2 négatifs hors-scope).
- **pytest : 3 passed** — `/me` : anonyme → 401/403, autorisé → 200 + principal, **Cerbos DENY → 403** (default-deny respecté).
- **Node : typecheck + build OK**, `dist/` produit.

## Périmètre couvert
- Logique des **policies Cerbos** account (positif + négatif de périmètre).
- **Chaîne d'autorisation Django** (PEP `CerbosPermission`) avec Cerbos **mocké** : authn requise, allow→200, deny→403, default-deny.
- **Compilation/typage** du service Node.

## Périmètre NON couvert (à ce stade)
- Intégration **live** (Keycloak réel, JWKS, Cerbos en conteneur) → voir fiche 03.
- Le **query plan** de liste (filtrage `scopeNode ∈ orgPath`) — pas encore testé (voir fiche 02).
- **Tests unitaires Node** (aucun `vitest` écrit), tests de **contrat** et **E2E**.
- Exécution réelle des **migrations** / Postgres (tests sous SQLite en mémoire).
