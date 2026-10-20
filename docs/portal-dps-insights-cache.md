# Portail DPS — cache insights (session + Mongo)

Complète [`medacap-competency-model.md`](./medacap-competency-model.md) §7 (agrégation live lente).

---

## Problème actuel

`dps-insights.php` recalcule à chaque appel (~650 requêtes Mongo, **~45 s** en local).  
Le portail masquait les cartes pendant ce délai.

---

## A — Déployé (React)

### Cache session (`sessionStorage`)

- Fichier : `frontend/src/utils/dpsScopeSessionCache.js`
- Clé : `cfao:dps-scope:{medacapUserId|username|email|mockId}`
- Contenu : payload scope MERGED (scope rapide + insights + PIF), identique à ce que consomme `mergeDpsScopeWithMock`
- Écriture : après succès `dps-insights.php` + `dps-pif.php`
- Lecture : au montage de `useDpsFilialeScope` — **retour détail marque instantané**, refresh en arrière-plan

### Affichage immédiat

- Section `#resultats` : skeleton **seulement** si chargement ET aucune donnée affichable (mock, cache ou scope partiel)
- Indicateur « Mise à jour… » reste actif pendant le refresh silencieux

---

## B — Cible Mongo (sans cron — Server 2003)

MEDACAP tourne sur **Windows Server 2003** : pas de cron fiable.  
Les agrégats existants (`technicianScores`, `technicianBrandScores`, `reports_subsidiary_results`) ne sont **pas** lus par le portail aujourd’hui.

### Collection dédiée : `portalDpsInsights`

Un document par couple **filiale × département** (ex. Cameroun Equipment).

```json
{
  "subsidiary": "Cameroun",
  "department": "Equipment",
  "computedAt": "2026-06-09T14:30:00Z",
  "computedBy": "manual|admin-script|batch",
  "brandStats": [],
  "collaboratorEvaluations": [],
  "recentLogs": []
}
```

**Format** : reprendre exactement les tableaux renvoyés aujourd’hui par `portalApiDpsFilialeInsights()` dans `bootstrap.php` — **aucun changement React** si l’API garde le même JSON.

Index recommandé :

```javascript
db.portalDpsInsights.createIndex(
  { subsidiary: 1, department: 1 },
  { unique: true }
)
```

### Lecture API

`dps-insights.php` :

1. `findOne({ subsidiary, department })` sur `portalDpsInsights`
2. Si trouvé et `computedAt` présent → réponse **< 100 ms**
3. Sinon → fallback agrégation live actuelle (compatibilité)

Option stricte prod : refuser le fallback et renvoyer `503` + message « lancer la mise à jour manuelle ».

### Mise à jour manuelle (sans cron)

Trois déclencheurs possibles sur Server 2003 :

| Méthode | Usage |
|---------|--------|
| **Script PHP CLI** | `php refresh-portal-dps-insights.php --subsidiary=Cameroun --department=Equipment` |
| **Page admin MEDACAP** | Bouton « Recalculer portail DPS » (POST sécurisé, profil Admin) |
| **Planificateur de tâches Windows** | Optionnel si disponible — **pas requis** |

#### Script `refresh-portal-dps-insights.php`

**Fichiers dans ce repo** (à copier sur MEDACAP) :

| Fichier | Rôle |
|---------|------|
| `scripts/medacap-api/portal-dps-insights-cache.php` | Lecture / écriture Mongo `portalDpsInsights` |
| `scripts/medacap-api/dps-insights.php` | Endpoint portail (cache puis fallback live) |
| `scripts/refresh-portal-dps-insights.php` | CLI refresh manuel |
| `scripts/medacap-api/README.md` | Procédure déploiement |

```text
1. Résoudre filiale + département (args ou --all-equipment)
2. users.find({ subsidiary, department, profile: Technicien })
3. portalApiDpsFilialeInsights()
4. upsert portalDpsInsights { subsidiary, department, computedAt, brandStats, ... }
5. Afficher durée + nb techniciens / marques
```

**Quand lancer la mise à jour manuelle :**

- Après campagne de tests / fin de session QCM
- 1× par semaine en routine métier
- À la demande avant une démo portail DPS

### Invalidation

Pas de trigger Mongo obligatoire. Règle simple :

- Nouveau `results` significatif → responsable filiale ou admin lance le script / bouton
- `computedAt` affiché dans le portail (« Données du … ») via `lastUpdatedAt` si l’API expose `computedAt`

### Réutilisation des agrégats existants

Avant de créer `portalDpsInsights`, auditer si `technicianBrandScores` + `technicianScores` peuvent alimenter le même JSON (mapping PHP).  
Sinon, `portalDpsInsights` reste la cible — rempli par le **même** job manuel que l’agrégation live actuelle.

---

## Ordre de déploiement recommandé

| Étape | Action | Effort |
|-------|--------|--------|
| ✅ A | Cache session + cartes immédiates (React) | Fait |
| ✅ B1 | Script PHP `refresh-portal-dps-insights.php` | Repo — déployer MEDACAP |
| ✅ B2 | `dps-insights.php` lit `portalDpsInsights` | Repo — déployer MEDACAP |
| B3 | Bouton admin + doc procédure filiale | MEDACAP + ops |

---

## Fichiers portail / MEDACAP

| Fichier | Rôle |
|---------|------|
| `frontend/src/utils/dpsScopeSessionCache.js` | Cache session |
| `frontend/src/hooks/useDpsFilialeScope.js` | Hydratation + `computedAt` API |
| `frontend/src/components/DpsCollaboratorResultsSection.jsx` | Skeleton conditionnel |
| `scripts/medacap-api/*.php` | Cache Mongo B (voir `scripts/medacap-api/README.md`) |

---

*Juin 2026 — CFAO Academy portail DPS.*
