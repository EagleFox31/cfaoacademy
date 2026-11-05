# Plan — Portail Super Admin · KPIs réels et BU-scoped

> **Date** : 2026-09-24
> **Itération** : suite du branchement `group-stats` (Mongo MEDACAP + HTTP cfao-needs) livré ce jour.
> **Auteur** : itération portail super admin.
> **Fichier compagnon** : [`BACKLOG_superadmin.md`](./BACKLOG_superadmin.md) — ce qui n'entre pas ici.

---

## 1. Contexte de départ (point de sortie 2026-09-24)

Le hero super admin affiche désormais 4 chiffres animés — apprenants / filiales / marques distinctes / formations programmées `{year}` — sourcés depuis :

| KPI | Origine |
|---|---|
| `learnerCount` (253) | Mongo `academy.users` (profile ~ Technicien) via module `analytics` cfao-core |
| `branchCount` (12) | Mongo `academy.subsidiaries` |
| `brandCount` (18) | Mongo `academy.users.brand{Junior,Senior,Expert}` — union normalisée (trim + upper + fix typos SINOTRUCK → SINOTRUK, MUTSIBUSHI → MITSUBISHI) |
| `trainingCount` (180) | `cfao-needs.campaigns_trainingsession` via **HTTP** `GET /api/v1/needs/analytics/scheduled-trainings?year=YYYY` (X-Analytics-Key) |

Chaîne : `SuperAdminDashboard` → `useSuperadminGroupStats` → `api.groupStats()` → cfao-core `analytics/services.group_stats()` → Mongo + HTTP cfao-needs. Cache TTL 60 s côté cfao-core (décorateur `@ttl_cache(60)` sur les 4 fonctions). Cold ≈ 1.5 s, chaud ≈ 0.1 s (13×).

### 1.1 Dette identifiée après le branchement (hardcodes visibles)

| Chose | Source actuelle | Vraie source à câbler | Impact UI |
|---|---|---|---|
| `brandCount` scopé BU | `activeBu === 'equipment' ? 11 : 9` dans [PortalHeader.jsx](../frontend/src/components/PortalHeader.jsx) | `group-stats?bu=equipment\|motors` filtré côté Mongo par `pole` | Le hero affiche des faux chiffres quand on switch BU |
| 18 filiales + learners par BU | `SUPERADMIN_FILIALES_DATA` dans [SuperAdminBuBrandsStrip.jsx](../frontend/src/components/SuperAdminBuBrandsStrip.jsx) | Nouveau champ `filiales[]` dans `group-stats` (aggregate par subsidiary + pole) | Strip filiales sous hero ment |
| `recentLogs` groupe | `mock_lms.u6.recentLogs` | Module `audit` cfao-core (`audit.services.record_audit` déjà en place) | Section `#logs` fictive |
| `filialesFormations` par filiale × année | `mock_lms.u6.filialesFormations` | Nouveau endpoint `cfao-needs` sur `campaigns_courseallocation` | Section `#branches` fictive |

---

## 2. Scope de cette itération — 4 items, indépendants entre eux

Chaque item = **1 endpoint + 1 hook + 1 remplacement hardcode + test end-to-end**. Aucune dépendance croisée : les 4 peuvent être livrés dans n'importe quel ordre.

### Item 1 · `group-stats` accepte `?bu=all|equipment|motors`

**API cfao-core**
- `GET /api/v1/core/analytics/group-stats?bu=equipment` — la réponse conserve sa structure, seuls les compteurs changent.
- Défaut `bu=all` (rétrocompat, comportement actuel).

**Backend** [analytics/services.py](../cfao-core/analytics/services.py)
- Helper interne `_pole_match(bu)` → renvoie un `$match` Mongo sur le champ `pole` (à confirmer sur `users` — sinon jointure via `subsidiaries.pole`).
- `count_technicians(bu)`, `count_distinct_brands(bu)` acceptent le paramètre.
- Clé de cache incluant `bu` (le décorateur `ttl_cache` mémorise déjà par tuple d'args).
- View : lit `request.query_params.get('bu', 'all')`, valide dans `{'all','equipment','motors'}` (sinon 400).

**Cerbos** — pas de changement (même ressource `group_stats`, même action `read`).

**Frontend**
- `useSuperadminGroupStats(user, { bu })` avec `bu` en dépendance `useEffect`.
- `SuperAdminDashboard` : passe `bu = activeBu` au hook.
- Suppression du hardcode 11/9 dans `PortalHeader.jsx` — remplacé par `apiStats.brandCount`.

**DoD**
- 3 valeurs distinctes selon BU sélectionnée dans le hero.
- Cache 60 s vérifié (2 calls dans 60 s : le second < 50 ms).
- Aucun 400 sur un BU valide.

---

### Item 2 · `filialesLearners` — compteurs par filiale × BU depuis MEDACAP

**API cfao-core**
- Nouveau champ dans la réponse `group-stats` :
```json
{
  "filiales": [
    { "filiale": "Cameroun", "countryCode": "cm", "all": 42, "motors": 28, "equipment": 14 },
    ...
  ]
}
```
- Ou endpoint séparé `/analytics/branches-learners` si la taille du payload gêne (~12 objets, préférer inline).

**Backend**
- Query Mongo aggregate :
  ```
  users.aggregate([
    { $match: { profile: /Technicien/i } },
    { $group: { _id: { sub: "$subsidiary", pole: "$pole" }, count: { $sum: 1 } } },
    ...
  ])
  ```
- Normalisation nom filiale (helper `_normalize_subsidiary` à côté de `_normalize_brand`).
- Résolution `countryCode` : mapping stable dans un dict (12 filiales) + fallback vide.

**Frontend**
- `SuperAdminBuBrandsStrip` reçoit `filiales` en prop (au lieu d'importer `SUPERADMIN_FILIALES_DATA`).
- Fallback silencieux sur l'ancienne const si `filiales` absent (résilience période transitoire).

**DoD**
- Strip filiales sous hero affiche les vrais compteurs MEDACAP par BU.
- Un tech ajouté en base apparaît après ≤ 60 s (TTL cache).

---

### Item 3 · `recentLogs` — activité groupe via module `audit` cfao-core

**API cfao-core**
- `GET /api/v1/core/audit/logs?scope=group&limit=20`
- Le module `audit` a déjà `record_audit()` en place. Vérifier / ajouter le viewset `list`.

**Cerbos**
- Ressource `audit_log` (existe déjà — [audit_log.yaml](../cerbos/policies/resource_policies/audit_log.yaml)).
- Action `list`, allow pour `superadmin`, `group_admin`.
- Tests positifs + négatifs (learner denied).

**Frontend**
- Hook `useAuditLogs({ scope: 'group', limit: 20 })`.
- `#logs` section : passer `recentLogs` du hook à `DpsActivitySection`.
- Adapter `guessLogType()` si nécessaire (déjà fait dans SuperAdminDashboard).

**DoD**
- Créer un user via API → événement audit visible dans `#logs`.
- Un learner qui tenterait d'y accéder est bloqué par Cerbos.

---

### Item 4 · `filialesFormations` — allocations par filiale/année depuis cfao-needs

**API cfao-needs** (nouveau endpoint)
- `GET /api/v1/needs/analytics/allocations-per-branch?year=2026`
- Auth : header `X-Analytics-Key` (même mécanisme que `scheduled-trainings`).
- Réponse :
```json
{
  "year": 2026,
  "allocations": [
    { "subsidiary": "Cameroun", "pole": "motors", "count": 152 },
    { "subsidiary": "Cameroun", "pole": "equipment", "count": 141 },
    ...
  ]
}
```
- Base SQL : `campaigns_courseallocation` (à confirmer schéma exact — schéma déjà présent en base).

**cfao-core**
- Nouvelle fonction `fetch_allocations_per_branch(year)` (HTTP, mêmes patterns que `count_scheduled_trainings`).
- Cache TTL 60 s (payload plus gros mais reste petit).
- Exposition : nouveau endpoint `/analytics/formations-per-branch?year=YYYY` **ou** inclusion dans `group-stats` sous `filialesFormations`.

**Frontend**
- Hook dédié ou extension de `useSuperadminGroupStats`.
- `SuperAdminDashboard.filialesFormations` : dérivé du hook au lieu du mock.
- La logique de filtrage BU (`filteredFormations`) reste identique — on remplace juste la source.

**DoD**
- Section `#branches` montre les vrais chiffres 2025 et 2026 par filiale.
- Le CTA "Voir les sessions" reste en `coming-soon` (drill-down = story future).

---

## 3. Ordre de livraison recommandé

Trié par ratio **valeur visible / effort** :

1. **Item 1** — BU scoping du `group-stats`. Le plus visible : dénormalise le hardcode le plus embarrassant du hero (11/9).
2. **Item 2** — `filialesLearners`. Rend vrai le bandeau filiales sous le hero (18 objets aujourd'hui hardcodés).
3. **Item 3** — `recentLogs`. Journal réel groupe.
4. **Item 4** — `filialesFormations`. Le plus lourd, dépend d'une classification `pole` à confirmer côté cfao-needs.

Livraison indépendante = si l'un bloque (schéma flou côté source), on livre les autres.

---

## 4. Definition of Done — critères transverses

- [ ] Policy Cerbos YAML testée avec **positifs + négatifs** (skill `cerbos-policy`).
- [ ] Cache TTL 60 s vérifié (2 calls consécutifs, second < 50 ms mesurable côté logs).
- [ ] Hook frontend en **fail-open** — endpoint down → mock ou 0, jamais crash React.
- [ ] Preflight CORS OK depuis `http://localhost:5173` en dev (déjà configuré).
- [ ] Aucun ajout de dépendance Python/JS — les 4 items utilisent l'existant (`pymongo`, `requests`, `psycopg` côté needs, `useEffect` côté front).
- [ ] Commit avec sujet `16-x: …` + ligne `Avancement:` (skill `commit-moa`).
- [ ] Aucun `console.log` / `print` de debug laissé.

---

## 5. Ce qui n'entre PAS dans cette itération

→ Voir [`BACKLOG_superadmin.md`](./BACKLOG_superadmin.md) — le backlog est un fichier vivant avec sections datées. Cette itération porte l'entrée `2026-09-24 — Snapshot initial post-branchement group-stats`.

## 6. Références

- [analytics/services.py](../cfao-core/analytics/services.py) — cache + fonctions Mongo/HTTP
- [analytics/views.py](../cfao-core/analytics/views.py) — GroupStatsView (Cerbos)
- [cfao-needs/api/analytics/views.py](../cfao-needs/api/analytics/views.py) — endpoint HTTP source de vérité
- [medacap-competency-model.md](./medacap-competency-model.md) — sémantique des champs Mongo
- [SPEC_RECUEIL_BESOINS_2027.md](./SPEC_RECUEIL_BESOINS_2027.md) — architecture cfao-needs détachable
- Mémoire projet `medacap-acronym` — le cycle MEDACAP en 7 étapes
- Skill `medacap-dps` — règles Mongo non-évidentes
