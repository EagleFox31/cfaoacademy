# MEDACAP — cache `portalDpsInsights` (option B)

Fichiers à déployer sur le serveur MEDACAP (`views/measure/api/`).

## Fichiers repo → MEDACAP

| Repo | MEDACAP |
|------|---------|
| `scripts/medacap-api/portal-dps-insights-cache.php` | `views/measure/api/portal-dps-insights-cache.php` |
| `scripts/medacap-api/dps-insights.php` | `views/measure/api/dps-insights.php` (remplace l’existant) |
| `scripts/medacap-api/portal-launch-define.php` | `views/measure/api/portal-launch-define.php` |
| `scripts/medacap-api/define-view-as-technician.php` | fragment à coller dans `views/define/dashboard.php` + `dashboard2026.php` |
| `scripts/refresh-portal-dps-insights.php` | `scripts/refresh-portal-dps-insights.php` (racine MEDACAP ou `scripts/`) |

## bootstrap.php

Ajouter après les autres `require_once` :

```php
require_once __DIR__ . '/portal-dps-insights-cache.php';
```

## Index Mongo

```javascript
db.portalDpsInsights.createIndex(
  { subsidiary: 1, department: 1 },
  { unique: true }
)
```

## Premier remplissage (manuel)

```bash
php scripts/refresh-portal-dps-insights.php --subsidiary=Cameroun --department=Equipment
php scripts/refresh-portal-dps-insights.php --all-equipment
```

Durée attendue : ~45 s par filiale (même coût qu’aujourd’hui), **une seule fois** ou après campagne de tests.

## Lecture API

`dps-insights.php` :

1. Lit `portalDpsInsights` par `{ subsidiary, department }` de l’utilisateur connecté
2. Si `computedAt` présent → JSON en < 100 ms (`source: portalDpsInsights`)
3. Sinon → fallback agrégation live (`source: live`, `computedAt: null`)

Champs JSON inchangés côté React : `brandStats`, `collaboratorEvaluations`, `recentLogs`.

## Prérequis bootstrap

Le endpoint suppose les helpers déjà présents dans `bootstrap.php` :

- `portalApiRequireBridgeKey()`
- `portalApiResolveUser($usersCollection)`
- `portalApiJson()` / `portalApiJsonError()`
- `portalApiDpsFilialeInsights()`, `portalApiResolveSubsidiaries()`, `portalApiTechnicianDepartmentFilter()`
