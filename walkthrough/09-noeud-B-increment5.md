# 09 — Nœud B · incrément 5 : /users/{id}/assignments + recompute auto (TDD + live)

## Contexte
Gérer les affectations d'un compte, et garder `scope_paths` cohérent **automatiquement**.

## État avant
- `/users` scopés (inc.4). `scope_paths` recalculé **manuellement** (seed). Pas d'endpoint d'affectation.

## Tests exécutés (écrits AVANT)
```bash
.venv/Scripts/python -m pytest -q          # 36 passed
docker run ... cerbos compile --tests ...  # 26 OK (+ role_assignment)
# live : POST affectation comme moa (group_admin) → recompute
```
Cas : **signal recompute** (création ET suppression d'affectation) ; POST in-scope→201 + recompute ;
**POST hors-scope→403 (négatif)** ; GET assignments. Cerbos `role_assignment` : admin in-scope ALLOW,
**hors-scope DENY**, **learner DENY**.

## Point de conception clé
Ajouter une affectation se contrôle contre le **périmètre de l'unité ciblée** (`role_assignment`,
orgPath = `scope_unit.path`), **pas** contre le scope actuel du compte (qui peut être vide → sinon
impossible de donner la 1ʳᵉ affectation). L'action custom fait donc son **propre check Cerbos explicite**.

## Modifications
- `identity/signals.py` (+ `apps.py ready()`) : `post_save`/`post_delete` sur `RoleAssignment`
  → `recompute_scope_paths()` automatique (robuste à la suppression en cascade).
- `identity/views.py` : action `@action(detail=True) assignments` (GET liste / POST crée, check `role_assignment`).
- `identity/serializers.py` : `AssignmentSerializer`.
- `cerbos/.../role_assignment.yaml` (+ test).
- `core/authz/permissions.py` : le PEP **défère les actions custom** (elles font leur propre check) ;
  seul `create` (collection) reste checké génériquement.

## Résultat final
- **pytest 36 passed** (32 + 4) ; **Cerbos 26 OK** (7+7+5+7).
- **Live** (moa group_admin affecte kouame à Dakar) : POST → **201**, affectations **1→2**,
  `scope_paths` **étendu automatiquement** avec les chemins du Sénégal (signal). Authz scope-de-l'affectation OK.

## Périmètre couvert
- CRUD affectations scopé (check contre le périmètre ciblé), **négatifs** (hors-scope, learner).
- **Cohérence automatique** de `scope_paths` (signal) — testée unitaire **et** live.

## Périmètre NON couvert (→ suite)
- **DELETE** d'une affectation via l'API (le signal gère déjà le recompte ; endpoint à exposer).
- **Multi-scope** : checks Cerbos via `scopeNode` singulier du token (pas `scopeNodes`).
- **Provisioning-on-login**, **contrat** Keycloak, **E2E** Playwright, départements seedés.
