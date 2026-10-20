---
name: medacap-dps
description: Business + visual rules for the MEDACAP competency model and the DPS portal (CFAO Academy). Use whenever working on technician competency tiers (Maintenance/Réparation/Diagnostic), brand-per-tier logic, Factuel/Déclaratif test batteries, multi-brand test construction, DPS score aggregation by brand, or the DPS portal UI (tier colors, data-freshness, method popovers). Encodes non-obvious Mongo business rules and the mandatory tier color norm so they are not re-derived wrong.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: June 2026
  abstract: Source-backed rules from docs/medacap-competency-model.md, docs/dps-competency-tier-visual.md and docs/portail-dps-fiabilite.md. Covers the MEDACAP Mongo model (brand-per-tier, cumulative test batteries, GF/specialities, multi-brand union) and the DPS portal visual + reliability norms.
---

# MEDACAP competency model + DPS portal

Référence unique pour coder tout ce qui touche aux **paliers de compétence technicien** et au **portail DPS**. Source de vérité : [docs/medacap-competency-model.md](../../../docs/medacap-competency-model.md), [docs/dps-competency-tier-visual.md](../../../docs/dps-competency-tier-visual.md), [docs/portail-dps-fiabilite.md](../../../docs/portail-dps-fiabilite.md).

## When to apply

- Filtrer/afficher des paliers Maintenance / Réparation / Diagnostic
- Calculer une moyenne ou un score **par marque** côté DPS
- Construire ou lire les tests technicien (Factuel/Déclaratif, multi-marque)
- Toute nouvelle surface UI DPS affichant un palier compétence
- Brancher l'API portail sur `views/measure/api/`

## Vocabulaire (mapping obligatoire)

| UI portail | Champ Mongo `users` | Niveau MEDACAP | Couleur | Hex |
|------------|---------------------|----------------|---------|-----|
| **Maintenance** | `brandJunior` | `Junior` | Bleu | `#1a56db` |
| **Réparation** | `brandSenior` | `Senior` | Orange | `#e67e00` |
| **Diagnostic** | `brandExpert` | `Expert` | Vert | `#1aab5b` |

| Type test | Code Mongo | Portail |
|-----------|------------|---------|
| Connaissances (QCM) | `Factuel` | `modality: theory` |
| Tâches pro. (+ validation manager) | `Declaratif` | `modality: practical` |

> En UI MEDACAP : **Groupe fonctionnel (GF) = Spécialité** (`speciality`).

## Règles métier non-évidentes (à ne pas réinventer)

1. **3 listes de marques par technicien**, une par palier (`brandJunior/Senior/Expert`) — pas une seule liste.
2. **Plus le palier monte, moins il y a de marques** (`brandJunior ⊇ brandSenior ⊇ brandExpert` en général).
3. **`level === Expert`** ⇒ les 3 champs sont en principe tous renseignés (on ne devient pas expert sans avoir parcouru les paliers inférieurs).
4. Les tableaux `brand*` peuvent contenir des **chaînes vides `""`** (slots de formulaire) — **toujours filtrer** avant comptage/affichage.
5. **Batteries cumulatives** selon `users.level` : Junior = Junior ; Senior = Junior + Senior ; Expert = Junior + Senior + Expert. Chaque palier = une paire (Factuel + Déclaratif).
6. **Test = multimarque, mono-palier, bi-type** : un document `tests` par (`user`, `type`, `level`) ; ses `quizzes` = **union dédupliquée** des `vehicles.quizzes` de chaque marque du palier (`$addToSet`).
7. **Score par marque** : un test Junior multi-marques doit être **compté sur CHAQUE marque** de `brandJunior`, pas seulement la première (`portalApiDpsAggregateBrandStats`).
8. Ne pas confondre `users.level` (batterie de tests à passer) avec l'objectif **PIF / certification** portail — couches différentes.

Chaîne complète : `brand* renseignées → updateTestQuizzes (union vehicles) → allocations → exams/results → API portail (evaluations.php, dps-scope.php) → React`.

## Norme couleur palier (OBLIGATOIRE)

**Une seule couleur par palier**, appliquée partout (bordure carte, puce niveau, initiales). Importer les composants, **ne jamais redéfinir les couleurs localement** :

| Rôle | Fichier |
|------|---------|
| Constantes + helpers | `frontend/src/utils/dpsCompetencyTierTheme.js` (`dpsCompetencyTierAccent`) |
| Puce palier | `frontend/src/components/DpsCompetencyTierChip.jsx` |
| Titre + initiales | `frontend/src/components/DpsCompetencyTierMemberTitle.jsx` |
| CSS | `frontend/src/styles/portal.css` — `.portal-tier-{junior\|senior\|expert}` |
| i18n | `cert_level_{maintenance\|repair\|diagnostic}` dans `frontend/src/i18n/portal.js` |

- Puce niveau & initiales : **fond blanc**, texte/contour/anneau = couleur du palier.
- **Ne PAS réutiliser** les tokens `progress` / `done` / `certified` du portail équipe pour les paliers MEDACAP.
- Hors scope de cette norme (autres systèmes de couleur) : scores de test (`evalScoreTier` dans `learnerTests.js`), statuts PIF/session (`portal-status-chip`), cartes manager (`TeamMemberCard`). Pour les statuts PIF/session voir [[portal-statuts]] (colorimétrie RAG/LMS) — distinct des paliers.

## Fiabilité des données (portail DPS)

Patterns livrés à réutiliser plutôt que réinventer :
- Fraîcheur : `PortalSectionHead` « Mis à jour il y a X min » (basé sur `lastUpdatedAt` API).
- Méthode de calcul : popover par section (`dps_method_pif/results/activity`).
- Chargement : `PortalSectionSkeleton` pendant la synchro périmètre (`useDpsFilialeScope` → `scopeLoading`).
- Activité : journal `lms.recentLogs` ; format API cible `{ at, actor, action, context }`.
- Mock vs API : tant que MEDACAP n'est pas joignable, mock u10 affiché ; le skeleton n'apparaît que si l'API est activée et en cours de fetch.

## Fichiers MEDACAP de référence (legacy PHP)

| Sujet | Fichier |
|-------|---------|
| 29 GF canoniques | `views/measure/userQuizDeclaratif.php` → `QuizConstants::$SPECIALTIES` |
| Régénération tests | `views/measure/_users-logic.php` → `updateTestQuizzes()` |
| API portail | `views/measure/api/{bootstrap,evaluations,dps-scope}.php` |
| Agrégation par marque | `bootstrap.php` → `portalApiBrandSlugsForTier()`, `portalApiDpsAggregateBrandStats()` |

> Collections Mongo `academy` : `users`, `quizzes`, `questions`, `vehicles` (pont marque×niveau×type→quiz), `tests`, `allocations`, `exams`, `results`. Doublons orthographiques de `speciality` à normaliser (« Boite »/« Boîte »).
