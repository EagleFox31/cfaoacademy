# 10 — Nœud B · incrément 6 : multi-scope (TDD + live)

## Contexte
Un user à **plusieurs affectations** doit être autorisé si **au moins un** de ses scopes couvre
la ressource (`exists s in scopeNodes : s in orgPath`). Dernière grande brique d'autorisation.

## État avant
- Checks Cerbos via `scopeNode` **singulier** (du token). `resolve_principal` exposait déjà
  `scopeNodes` (pluriel) mais seulement dans `/me`, pas dans l'autorisation.

## Tests exécutés
```bash
docker run ... cerbos compile --tests   # 28 OK (dont test positif multi-scope)
.venv/Scripts/python -m pytest -q        # 38 passed (dont 2 filtres `exists`)
# live : aminata devient branch_hr de 2 filiales → voit l'union
```

## Point clé : l'AST du query plan
La condition `scopeNodes.exists(s, s in orgPath)` produit un plan **non trivial** (capturé live) :
```json
{"operator":"exists","operands":[
  {"value":["groupe.cmr","groupe.civ"]},
  {"expression":{"operator":"lambda","operands":[
     {"expression":{"operator":"in","operands":[{"variable":"s"},{"variable":"request.resource.attr.orgPath"}]}},
     {"variable":"s"}]}}]}
```
→ traduit en **OR** de `field__contains=[v]` sur chaque scope (`filters.py._exists_to_q`).

## Modifications
- `cerbos/policies/derived_roles/scope.yaml` : conditions → `…scopeNodes.exists(s, s in …orgPath)`
  (within_org_scope **et** admin_within_scope).
- `cerbos/tests/*` : principals `scopeNode: "x"` → `scopeNodes: ["x"]` ; + test **positif multi-scope**.
- `core/authz/filters.py` : handler `exists` (`_exists_to_q`) → OR de `contains`.
- `core/auth/principal.py` : `attr.scopeNodes` (liste).
- `core/auth/oidc.py` : `_apply_db_scope()` — **résolution du périmètre côté service** (rôles +
  scopeNodes multi-affectations depuis la DB) à l'authentification ; repli sur les claims si compte inconnu.
- Tests filtres : `test_exists_multi_scope`, `test_exists_mono_scope`.

## Résultat final
- **Cerbos 28 OK** ; **pytest 38 passed**.
- **Live** : aminata (branch_hr de CIV **+** Sénégal) → `/me scopeNodes = [cote_divoire, senegal]` ;
  `/users` = **4** (union CIV ∪ Sénégal : kouame, aminata, seydou, fatou). **Aucun rebuild** (hot-reload).

## Périmètre couvert
- Autorisation **multi-scope** (objet + liste) de bout en bout : policy `exists`, query plan `exists`,
  filtre Postgres OR de `contains`, principal résolu en base.
- Le mono-scope reste un cas particulier (liste à 1 élément) — non régressé.

## Périmètre NON couvert (→ suite)
- **Cache** de la résolution DB (aujourd'hui une requête à chaque authentification).
- DELETE d'affectation via l'API ; provisioning-on-login ; contrat Keycloak ; départements seedés ; E2E Playwright.
