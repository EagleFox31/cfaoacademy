# 05 — Nœud B (Identity) · incrément 1 : modèle de domaine + résolution de périmètre (TDD)

## Contexte
Premier incrément de B, le **socle d'autorisation** : modèle org + comptes + affectations,
et la **résolution du principal côté service** (le périmètre appartient à identity, pas au token).
Réalisé en TDD (tests rouges → implémentation → vert).

## État avant
- `identity` n'avait qu'un endpoint `/me` (lecture des claims du token). Aucun modèle.
- Opérateur de query plan `scopeNode ∈ org_path` livré (fiche 04) → filtrage scopé prêt.

## Tests exécutés (écrits AVANT le code)
```bash
cd cfao-core && .venv/Scripts/python -m pytest identity/tests/test_models.py identity/tests/test_services.py -q
.venv/Scripts/python -m pytest -q   # suite complète (non-régression)
```
Cas :
- **org_path** : arbre group→region→branch→agency → `code` pointé + `path` cumulé + `scope_node`.
- **Règle Equipment** (3 cas) : PL hors Equipment → refus ; PL dans Equipment → ok ; VL dans Motors → ok.
- **`resolve_principal`** : union des affectations actives (rôles, scopeNodes, marques) ; affectation inactive ignorée.

## Erreurs rencontrées
- **Phase rouge attendue** : `ModuleNotFoundError: identity.models` (modèles inexistants) → 2 erreurs de collecte.
- Aucune surprise en phase verte (TDD propre).

## Modifications
- `identity/models.py` : `OrgUnit` (arbre, `code`/`path` dénormalisés au `save`), `Brand`, `Department`
  (`clean()` applique la règle Equipment), `User` (lié `keycloak_sub`), `RoleAssignment` (cumulable).
- `identity/services.py` : `check_equipment_rule()` (pure) + `resolve_principal()` (union des affectations actives).
- `identity/migrations/0001_initial.py` (généré).

## Résultat final
- **7/7** sur B (4 modèles + 3 services) ; **18/18** suite complète — aucune régression.

## Périmètre couvert
- Dénormalisation `org_path`/`code` (= scopeNode), cohérente avec le format du realm Keycloak.
- **Règle métier Equipment** (PL/engins/chariots/bus = département Equipment) — sens PL→Equipment.
- **Résolution multi-affectations** : rôles/scopeNodes/marques en union ; inactif ignoré.

## Périmètre NON couvert (→ incréments suivants de B)
- **Endpoints/viewsets** `/org/*`, `/users`, `/users/{id}/assignments` (via l'usine, scopés par query plan) + leurs **tests négatifs** (IDOR, élévation de privilège).
- **`/me` v2** : bascule de la lecture des claims → `resolve_principal()` (DB) avec cache.
- **Policies Cerbos** `branch/department/agency/brand` + **forme multi-scope** (`exists s in P.attr.scopeNodes : s in R.attr.orgPath`) — la policy actuelle est mono-`scopeNode`.
- **Provisioning Keycloak** (création compte/rôles/attributs) + contrat.
- **Migration appliquée en live** (recréer `core` au prochain incrément avec endpoints) + **TI Postgres** du filtre `org_path__contains` (maintenant qu'un modèle scopé existe).
- **E2E** création org→user→login→/me→accès scopé.
