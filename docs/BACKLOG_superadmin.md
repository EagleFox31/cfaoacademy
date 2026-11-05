# Backlog — Portail Super Admin

> Fichier **vivant**. Chaque itération ajoute une section **datée en haut** du fichier
> (chronologique inverse). Les items livrés sont déplacés dans la section
> [Livré (historique)](#livré-historique) en bas — jamais supprimés.
>
> Plan de l'itération courante : [`PLAN_superadmin_kpis_reels_2026-09-24.md`](./PLAN_superadmin_kpis_reels_2026-09-24.md)

---

## 2026-09-24-02 — learnerCount branché sur Clé de Répartition (cfao-needs)

**Contexte** : MEDACAP ne contient que les techniciens évalués (253), pas l'ensemble
des effectifs déclarés par les filiales. Le hero passe sur `campaigns_branchbrandquota`
(Clé de Répartition 2026) : Equipment 392 / Motors 984 / all 1 376. Nouveau endpoint
cfao-needs `GET /api/v1/needs/analytics/total-technicians?bu=&year=` + `count_technicians()`
dans cfao-core remplacé (HTTP relay au lieu de Mongo MEDACAP).

---

## 2026-09-24 — Snapshot initial (post-branchement `group-stats` + cache HTTP)

**Contexte** : le hero super admin passe sur vraies données MEDACAP + cfao-needs.
Les 4 chiffres animés (apprenants / filiales / marques / formations `{year}`) sont
live avec cache TTL 60 s. Cette entrée capture **ce qui n'est pas couvert par
l'itération en cours** — à faire ensuite.

### 2026-09-24-01 — Non couvert dans l'itération, à reporter

| ID | Item | Priorité | Effort | Notes |
|---|---|---|---|---|
| **SA-01** | Section `#alerts` — santé services, campagnes en erreur, budget saturé | P1 | S | Nouvelle vue agrégée (Cerbos health, cfao-needs digest erreurs, Mongo lag). Endpoint `/analytics/alerts` |
| **SA-02** | Audit trail groupe **visualisable** (recherche + filtres) | P1 | M | Le module `audit` cfao-core enregistre déjà (`record_audit`). L'item 3 du plan ajoute une liste basique — cet item = vraie vue avec search/filter/pagination. |
| **SA-03** | KPI budget / coûts formation (coût moyen tech certifié, ratio conso/alloué) | P2 | M | Dépend d'un référentiel financier absent aujourd'hui — probablement à sortir d'un export SI RH |
| **SA-04** | Vue admin users groupe (create / deactivate cross-filiale) | P2 | M | Reprendre `HrDirectoryAdmin` avec variant `scope='group'`. Composant existe côté RH. |
| **SA-05** | Roadmap gate go-live (checklist 00-8) intégrée en section | P2 | S | Existe partiellement dans `/portail/delivery` — surfacer en `#roadmap` |
| **SA-06** | Rapport MOA hebdo (digest vendredi) affiché en section | P2 | S | Existe côté [delivery/aggregators.py] — ajouter section `#weekly-digest` avec le dernier envoi |
| **SA-07** | Comparatif période N vs N-1 au niveau groupe | P2 | S | Composant `PerformanceComparatif` existe côté MEDACAP framework — `scope='group'` |
| **SA-08** | Actions rapides — communiqué groupe, campagne inter-filiales, bulk deactivate | P3 | M | Bloc CTA sticky ou side panel, réservé aux actions à impact large |
| **SA-09** | Nombre de filiales déployées **par app** (section `#bilan`) | P3 | M | Manque source. Options : (a) JSON groupe versionné, (b) `cfao-operations` quand app 04 sera live |
| **SA-10** | `filialesCompetences` réels par filiale | P3 | M | Nécessite parcourir 12 filiales via MEDACAP `dps-scope` — coûteux, à batcher / cacher |
| **SA-11** | Marques par pole depuis MEDACAP (au lieu de `SUPERADMIN_EQUIPMENT_BRANDS` / `_MOTORS_BRANDS` hardcodés) | P2 | S | Extension de l'item 1 du plan — sortir la liste (pas juste le count) |
| **SA-12** | Retirer le CTA `coming-soon` sur `#branches` — vraie route filiale | P3 | L | Nécessite construire `/portail/filiale/:slug` (page filiale drill-down) |

### Legend

- **Priorité** :
  - `P0` bloquant / go-live impossible sans
  - `P1` haut / valeur métier immédiate
  - `P2` moyen / améliore l'usage sans être critique
  - `P3` bas / polish, dépendance externe, hors chemin critique
- **Effort** :
  - `S` ≤ 1j (un fichier ou deux, endpoint + hook + hardcode remplacé)
  - `M` 1-3j (nouvelle section, plusieurs endpoints, tests)
  - `L` > 3j (nouvelle route, composant complexe, dépendance externe)
- Chaque item devient une **story `16-N`** quand elle entre en itération suivante.

---

## Pattern pour la prochaine itération

Ajouter la section suivante **en haut du fichier**, juste sous le titre principal :

```markdown
## YYYY-MM-DD — Titre court de l'itération

**Contexte** : phrase courte sur ce qui vient de sortir.

### YYYY-MM-DD-NN — Non couvert dans l'itération, à reporter

| ID | Item | Priorité | Effort | Notes |
|---|---|---|---|---|
| SA-XX | ... | Px | S/M/L | ... |

---
```

**Règles**
- Ne **jamais** renuméroter les IDs (`SA-XX` = identifiant stable dans le temps).
- Ne **jamais** supprimer un item — le déplacer dans [Livré (historique)](#livré-historique) ou marquer `WONTFIX` avec la date + raison.
- Le sous-titre `YYYY-MM-DD-NN` (`NN` = 01, 02… si plusieurs blocs le même jour) permet des ancres HTML stables.
- Chaque nouvelle section **complète** cette liste ; on ne récrit pas les items déjà en backlog.

---

## Livré (historique)

*Cette section reçoit les items livrés. Format : `SA-XX (YYYY-MM-DD → YYYY-MM-DD) — Titre — sortie dans commit \`16-x: …\``.
Elle documente la traçabilité — chaque livraison enrichit la liste.*

_Vide au 2026-09-24._

---

## WONTFIX (historique)

*Cette section reçoit les items abandonnés avec la raison. Format : `SA-XX (YYYY-MM-DD) — Titre — Raison : …`.
Utile pour ne pas les proposer à nouveau plus tard._

_Vide au 2026-09-24._
