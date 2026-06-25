# 04 — Opérateur query plan `scopeNode ∈ org_path` (TDD)

## Contexte
Prérequis bloquant de B : traduire le **query plan Cerbos** en filtre `Q` Django pour le
**filtrage de liste au périmètre**. Le cas central est l'appartenance `scopeNode ∈ org_path`,
que l'architecture signale comme nécessitant un opérateur custom (`architecture.md §5.3`).
Réalisé en **TDD** (tests rouges → implémentation → vert).

## État avant
- `core/authz/filters.py` partiel : gérait `eq`, `and`, `or`, et `in` **dans un seul sens**
  (`field IN [valeurs]`). Le cas `valeur ∈ variable-liste` produisait un filtre **faux**
  (`org_path__in='groupe.cmr'`) → en pratique fail-closed/liste vide.
- Aucun test unitaire sur le traducteur.

## Tests exécutés
```bash
cd cfao-core && .venv/Scripts/python -m pytest core/tests/test_filters.py -q   # 8 cas
.venv/Scripts/python -m pytest -q                                              # suite complète
```
Cas couverts (`core/tests/test_filters.py`) : `ALWAYS_ALLOWED`→`Q()` ; `ALWAYS_DENIED`→`DeniedAll` ;
**`scalaire ∈ liste`** (scope) ; `variable ∈ [valeurs]` ; `eq` ; `and` ; `or` ; opérateur non géré → `DeniedAll` (fail-closed).

## Erreurs rencontrées
- **Phase rouge (attendue)** : 2/8 tests échouent — `in` traité dans un seul sens.
  `<Q: ('org_path__in', 'groupe.cmr')>` ≠ attendu `<Q: ('org_path__contains', ['groupe.cmr'])>`.

## Modifications
- `core/authz/filters.py` — branche `in` dédoublée :
  - **valeur scalaire** + variable liste → `Q(field__contains=[valeur])` (appartenance) ;
  - **variable scalaire** + liste de valeurs → `Q(field__in=[...])`.
  Détection par `isinstance(value, list)` ; identification variable/valeur indépendante de l'ordre des opérandes.

## Résultat final
- **8/8** sur le traducteur, **11/11** sur la suite complète (3 identity + 8 filters) — **aucune régression**.

## Périmètre couvert
- Traduction AST → `Q` pour `eq`, `in` (les **deux sens**), `and`, `or`, et le fail-closed sur opérateur inconnu.
- Le filtre de **périmètre** `scopeNode ∈ org_path` produit le bon `Q` (`__contains`).
- Logique pure, testée **sans DB** (comparaison d'objets `Q`).
- ✅ **AST confirmé contre le PDP live** (après redémarrage de Docker Desktop) : le plan réel
  renvoyé par `POST /api/plan/resources` (kind `account`, action `list`, principal `branch_admin`)
  correspond **exactement** au cas testé :
  ```json
  {"kind":"KIND_CONDITIONAL","condition":{"expression":{"operator":"in",
    "operands":[{"value":"groupe.cmr"},{"variable":"request.resource.attr.orgPath"}]}}}
  ```
  → aucun ajustement de `filters.py` nécessaire.

## Périmètre NON couvert / à suivre
- **Exécution SQL réelle** : `__contains` sur liste requiert **Postgres** (ArrayField/JSONField `@>`) ;
  non exécutable sous SQLite (tests unitaires en mémoire). → couvrir en **TI Postgres** (Testcontainers),
  quand un vrai modèle scopé existera (nœud B).
- Opérateurs Cerbos additionnels éventuels (`gt/lt/startsWith/has…`) : non gérés → fail-closed jusqu'à besoin avéré.

## Incident infra noté
Docker Desktop a connu une **dégradation de son plan de contrôle** (API moteur `v1.54` → HTTP 500 sur
`containers/json` ; port-forwarding hôte HS → `curl localhost` timeout exit 28/56) **sans arrêter les
conteneurs**. Résolu par **redémarrage de l'application** Docker Desktop (le service Windows, non
redémarrable sans admin, n'était pas nécessaire). Données préservées (volumes).
