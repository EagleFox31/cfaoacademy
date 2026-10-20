---
name: cerbos-policy
description: Author and test Cerbos authorization policies for CFAO Academy (cfao-core + cfao-operations share one PDP). Use when writing or reviewing a resource policy, a derived role, or policy tests under cerbos/, or when reasoning about org-scope/department/brand access. Enforces default-deny, the common_scope derived roles (scopeNodes ∈ orgPath, multi-scope), mandatory positive AND negative tests, and the critical roles+derivedRoles = OR gotcha.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: June 2026
  abstract: Encodes the cerbos/ structure and architecture.md §5.3. Cerbos is the shared PDP; every endpoint is a PEP. Policies are default-deny; the within_org_scope / admin_within_scope derived roles factor the org-hierarchy check used everywhere.
---

# Policy Cerbos (authZ partagée)

Source : `cerbos/` (réel), [architecture.md](../../../architecture.md) §5.3. Un **PDP Cerbos partagé** par les deux services ; chaque endpoint est un PEP. **Default-deny** : toute action non listée est refusée.

## When to apply

- Écrire une `resource_policy` pour une nouvelle ressource
- Modifier un rôle dérivé ou une condition de périmètre
- Revoir une policy / ajouter ses tests
- Raisonner sur scope org / department / brand

## Structure

```
cerbos/
├── config.yaml
├── policies/
│   ├── _schemas/principal.json          # attrs principal (scopeNodes, departments, brands…)
│   ├── derived_roles/scope.yaml         # common_scope : within_org_scope, admin_within_scope
│   └── resource_policies/<resource>.yaml
└── tests/<resource>_test.yaml           # positif ET négatif (obligatoire)
```

## Rôles dérivés factorisés (`common_scope`)

Réutiliser, ne pas réinventer la condition de scope. Condition réelle (multi-scope) :

```yaml
expr: request.principal.attr.scopeNodes.exists(s, s in request.resource.attr.orgPath)
```

- `within_org_scope` — **lecture** dans le périmètre : admins, RH, direction (large).
- `admin_within_scope` — **écriture** dans le périmètre : admins seulement.
- Multi-scope : autorisé si **au moins un** `scopeNode` du principal couvre la ressource.

## ⚠️ Gotcha critique — `roles` + `derivedRoles` = **OU** (pas ET)

Dans une même règle, combiner `roles:` et `derivedRoles:` donne un **OU**. Pour exiger « rôle admin **ET** dans le scope », utiliser le **rôle dérivé seul** (`admin_within_scope`), qui porte déjà à la fois le `parentRoles` et la condition de périmètre.

## Patron de resource policy (référence : `account.yaml`)

```yaml
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: default
  resource: <resource>
  importDerivedRoles:
    - common_scope
  rules:
    # self (ex. /me)
    - actions: ["view:self"]
      effect: EFFECT_ALLOW
      roles: ["*"]
      condition:
        match:
          expr: request.principal.id == request.resource.id

    # lecture dans le périmètre (rôle dérivé seul → ET scope)
    - actions: ["view", "list"]
      effect: EFFECT_ALLOW
      derivedRoles: [within_org_scope]

    # écriture dans le périmètre (admins seulement, ET scope)
    - actions: ["create", "update"]
      effect: EFFECT_ALLOW
      derivedRoles: [admin_within_scope]
```

Règles de conception :
- **Default-deny** : ne lister que ce qui est autorisé ; tout le reste est refusé.
- `brand` / `department` = filtres additionnels combinés en **ET** dans le `condition`.
- Pour les **listes**, le service utilise `plan_resources` (query plan) — la policy doit rester exprimable côté plan.

## Tests (obligatoires, positif + négatif)

`cerbos/tests/<resource>_test.yaml` : déclarer des `principals` (in-scope ET out-of-scope), des `resources` (in-scope / out-of-scope), puis les `tests` avec `expected`. **Le test négatif** (« un user sans droit / hors périmètre est bien refusé ») est exigé par le gabarit (OWASP A01 / ASVS).

```bash
docker run --rm -v "$PWD/cerbos:/cerbos" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/cerbos/tests /cerbos/policies
```

## Liens

- Câblage côté service (PEP, ScopedCerbosViewSet, fail-closed) : [[module-securise]].
- Journaliser la validation des tests : [[walkthrough-fiche]].
