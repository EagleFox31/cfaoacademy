# 02 — Usine à apps : génération réelle d'un module

## Contexte
Valider que le générateur `scripts/new_module.py` (étape 2) produit un module
**qui passe réellement** les tests (Django + Cerbos), pas seulement qui compile.

## État avant
- Briques `core/` écrites : `ScopedModel`, `ScopedCerbosViewSet` (filtrage de liste par query plan), `CerbosPermission` (mapping actions ViewSet + liste déférée au plan).
- Générateur écrit, **validé uniquement en `--dry-run`** (compile les gabarits, parse les YAML, n'écrit rien).

## Tests exécutés
```bash
# Génération réelle (écrit le module + policy + tests, câble INSTALLED_APPS/urls)
python scripts/new_module.py catalog Course

# Tests Django (identity + module généré)
cd cfao-core && .venv/Scripts/python -m pytest -q

# Tests Cerbos (account + course généré)
docker run --rm -v "C:/.../cerbos:/work" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/work/tests /work/policies

# Nettoyage (module jetable de démonstration)
rm -rf cfao-core/catalog cerbos/policies/resource_policies/course.yaml cerbos/tests/course_test.yaml
# + retrait des 2 lignes câblées dans base.py / urls.py
```

## Erreurs rencontrées
1. **DRF — pagination cassée (2 tests rouges).** `FieldError: Cannot resolve keyword 'created'`. Cause : `CursorPagination` ordonne par `-created` par défaut, or le champ du `ScopedModel` est `created_at` → toute liste plantait.
2. **Cosmétique** — le câblage `INSTALLED_APPS`/`urls.py` insérait la ligne avec une double indentation (8 espaces).

## Modifications
- `cfao-core/core/pagination.py` : `TimestampCursorPagination` (`ordering = "-created_at"`), définie comme `DEFAULT_PAGINATION_CLASS`. → bénéficie à **tous** les modules générés (ils héritent `created_at`).
- `scripts/new_module.py` : indentation du câblage corrigée (insertion propre à 4 espaces).

## Résultat final
- **pytest : 6 passed** (3 `identity` + 3 `catalog` généré).
  - `catalog` : liste anonyme → 401/403 ; query plan `ALWAYS_ALLOWED` → 200 ; query plan `ALWAYS_DENIED` → 200 **liste vide** (fail-closed).
- **Cerbos : 11/11 OK** (7 account + 4 course généré, dont négatif hors-scope).
- Module de démo **supprimé**, dépôt revenu à la base propre (**3 pytest / 7 Cerbos**).

## Périmètre couvert
- Le générateur produit un module **qui compile ET passe** ses tests Django + Cerbos.
- **Filtrage de liste par query plan** : chemins `ALWAYS_ALLOWED` et `ALWAYS_DENIED` (fail-closed) testés.
- Garantie « secure-by-default » : impossible de générer sans PEP Cerbos, default-deny, test négatif.

## Périmètre NON couvert
- **Query plan `KIND_CONDITIONAL`** réel (`scopeNode ∈ org_path`) : `filters.py` est volontairement partiel → fail-closed. **Opérateur custom à implémenter (story dédiée)** avant un filtrage scopé fin en liste.
- `create/update/delete` du module généré **à travers Cerbos réel** (testé seulement en policy + en liste).
- Génération d'un module **Node** (le générateur ne couvre que Django pour l'instant).
- Migrations réelles (tables créées par syncdb en test SQLite).
