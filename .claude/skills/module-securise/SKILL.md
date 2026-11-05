---
name: module-securise
description: Scaffold and review a new secure scoped Django module in cfao-core (CFAO Academy), following the "/me" secure template and the module generator. Use when creating a new business app/module in cfao-core, adding a scoped resource + endpoints, or reviewing backend code for the default-deny Cerbos PEP pattern. Enforces ScopedModel (org_path/department/brand), ScopedCerbosViewSet, query-plan-filtered lists, fail-closed, and mandatory negative authz tests.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: June 2026
  abstract: Encodes BACKEND.md (usine à apps + patron sécurisé) and architecture.md §5.3. Every new module inherits OWASP A01 / ASVS posture by default; the GET /api/v1/core/me endpoint is the reference template the generator copies.
---

# Module Django sécurisé (usine à apps)

Source : [BACKEND.md](../../../BACKEND.md), [architecture.md](../../../architecture.md) §5.3. Le patron de référence est **`GET /api/v1/core/me`** : JWT Keycloak → `build_principal()` → `CerbosPermission` (default-deny). Tout nouveau module se génère, jamais réécrit à la main.

## When to apply

- Démarrer une nouvelle app métier dans `cfao-core` (LMS, recruitment, analytics…)
- Ajouter une ressource scopée + ses endpoints REST
- Revoir une PR backend pour la conformité sécurité (PEP/PDP, fail-closed, tests négatifs)

## Générer un module (ne pas scaffolder à la main)

```bash
# Aperçu sans écrire (compile gabarits, valide YAML) :
python scripts/new_module.py <app> <Resource> --dry-run
# Génération réelle :
python scripts/new_module.py <app> <Resource>
cd cfao-core && python manage.py makemigrations <app> && python manage.py migrate && pytest <app>
```

Le générateur câble `INSTALLED_APPS` + `config/urls.py` (idempotent) via les ancres **`# <generated-apps>`** (`config/settings/base.py`) et **`# <generated-routes>`** (`config/urls.py`) — **ne pas retirer ces ancres**.

## Ce que chaque module hérite automatiquement (briques `core/`)

- **`ScopedModel`** — périmètre 3D `org_path` / `department` / `brand` (`core/models.py`).
- **`ScopedCerbosViewSet`** — PEP Cerbos **default-deny**, check objet, **liste filtrée par query plan** (fail-closed) (`core/authz/viewsets.py`).
- Policy Cerbos `default-deny` + tests **positif ET négatif** générés.
- Tests Django : liste anonyme refusée, liste filtrée par le plan, fail-closed si plan refusé.

## Flux d'autorisation par requête (PEP → PDP)

```
1. Middleware valide le JWT Keycloak (signature JWKS).
2. build_principal() : { id, roles, attr:{ scopeNodes, departments, brands, orgPath } }
   (rôles depuis le token ; scope = source de vérité côté identity, avec cache)
3a. Action sur UNE ressource → charger la ressource + attr { orgPath, department, brand }
    → cerbos.check_resource(principal, resource, action) → ALLOW / DENY
3b. LISTE → cerbos.plan_resources(principal, "read", kind)
    → traduire le plan en filtre queryset (core/authz/filters.py) — jamais de filtrage à la main
```

`scopeNode ∈ orgPath` règle toute la hiérarchie en une comparaison ; `brand` et `department` sont des filtres additionnels combinés en **ET**.

> **Note d'implémentation** : Cerbos n'a pas d'adaptateur query-plan pour le Django ORM. `core/authz/filters.py` parse l'AST du plan vers des objets `Q` ; `scopeNode in orgPath` (scalaire ∈ liste) demande un **opérateur custom** émettant `:scope = ANY(org_path)`. Détails : `architecture_complement.md` §1.

## Checklist de revue (refuser la PR sinon)

- [ ] **PEP Cerbos sur chaque endpoint** — pas de `cerbos_resource_kind` ⇒ accès refusé.
- [ ] **Fail-closed** : PDP indisponible ⇒ refus (pas de bypass).
- [ ] **Tests négatifs d'autorisation** présents (un user hors périmètre est bien refusé).
- [ ] Liste filtrée par **query plan**, jamais de `.filter()` de périmètre à la main.
- [ ] `ScopedModel` utilisé pour les ressources scopées.
- [ ] **Aucun secret** dans le diff (`.env.example` seulement) — secret scanning CI vert.
- [ ] Policy Cerbos écrite/testée → voir [[cerbos-policy]].
- [ ] **Budget de ressources déclaré** si la PR ajoute ou modifie un conteneur (ci-dessous).

## Budget de ressources (tout nouveau conteneur)

Norme projet — `planning.md` §7, `architecture.md` §7. Un conteneur sans plafond peut
prendre toute la machine ; sur une infra partagée, c'est le voisin qui tombe et le
diagnostic part dans la mauvaise direction.

- [ ] `mem_limit` déclaré, **calibré sur une mesure** (`docker stats` sur la stack
      démarrée), marge 3 à 8× la consommation observée. Un plafond deviné est soit
      inutile, soit une panne différée.
- [ ] `restart: unless-stopped` sur tout service persistant.
- [ ] **Pas de `cpus:`** — le throttling est silencieux et se diagnostique mal. Si la
      consommation CPU au repos est anormale, corriger la **cause** (cadence de
      scrutation, nombre de workers), jamais par un plafond.
- [ ] **Valeurs par défaut du composant tiers remises en cause** : elles visent le cas
      d'usage du fournisseur, pas le nôtre. Vérifier au minimum le tas JVM, le nombre de
      workers et les intervalles de scrutation.
- [ ] La stack a été **réellement démarrée** avant le push — c'est le seul moment où l'on
      découvre qu'un conteneur ne démarre pas.

```bash
docker compose up -d
# Laisser reposer : les JVM mentent pendant 60 s. Et un echantillon unique attrape
# les sondes de sante au vol — prendre PLUSIEURS releves avant de conclure.
for i in 1 2 3; do docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"; sleep 8; done
```

## Tests (séquence projet)

```bash
cd cfao-core && pytest          # SQLite en mémoire, pas besoin de Postgres
# Policies (inclut tests négatifs) :
docker run --rm -v "$PWD/cerbos:/cerbos" ghcr.io/cerbos/cerbos:0.40.0 \
  compile --tests=/cerbos/tests /cerbos/policies
```

Séquence par story : **TU → TI → contrat → E2E** (`planning.md §6`). Journaliser la validation : [[walkthrough-fiche]].
