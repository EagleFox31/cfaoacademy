# Plan — E-learning Toyota (TEAM-GP) dans portail KI / PIF

**Contexte :** classeur `Suivi_Techniciens_02-09-2026_harmonise.xlsx` (SI TEAM-GP)  
+ MEDACAP (techniciens filiale KI) + détail PIF / résultats Toyota.

## Problème d’accès détail marque (résolu côté code)

| Élément | État |
|---------|------|
| UI liste | **Réutilisée** (`KiToyotaFilialeResultsSection` → `DpsCollaboratorResultsSection`) |
| Route | `/portail/competences/:brandId` (même que DPS) |
| Blocage | Garde-fou **DPS/DOP only** → KI renvoyé au portail |
| Correctif | Accès KI/PIC + scope `useKiFilialeScope` + retour `#toyota-resultats` |

→ Architecture métier **réutilisable** ; c’était un **branchement d’accès**, comme pour le PIF.

---

## Objectif métier (plan global)

1. **Gérer les techniciens** (rapprochement Excel ↔ MEDACAP, puis règle auto).  
2. **E-learning Toyota obligatoire** pour tous les paliers G4→G1.  
3. **Recenser** le nombre de modules e-learning **par niveau** (G4, G3, G2, G1).  
4. **PIF détail** : 4ᵉ carte KPI = volume e-learning dû / fait selon niveau technicien + niveau Toyota.  
5. **Résultats Toyota (KI)** : carte dédiée « E-learning » à côté de la maîtrise compétence.

---

## Phase A — Rapprochement identité (Excel ∩ MEDACAP)

**Entrées**
- Excel `Synthèse` : `ID TEAM-GP`, `NOMS ET PRENOMS`, atelier  
- MEDACAP `users` (scope KI) : `_id`, `username`, `firstName`/`lastName`, brands Toyota  

**Règle de match (ordre)**
1. Match fort si un jour on a `ID TEAM-GP` / matricule dans MEDACAP  
2. Sinon cluster `norm(nom+prénom)` Excel ↔ `norm(displayName)` MEDACAP  
3. Ambiguïté / 0 match → **file de revue** (pas de fusion auto)

**Sortie**
- Table `teamgp_medacap_link` (ou JSON versionné hors DCP pour dry-run) :  
  `{ teamGpId, medacapUserId, confidence, status: linked|review|unmatched }`  
- Dry-run d’abord (skill `etude-si`) — **pas d’écriture** tant que revue non tranchée.

**Déjà observé** : KITIO / EVINA / MOUTAPAM / TEKOU / SILIKI… apparaissent des deux côtés (à confirmer par script de match).

---

## Phase B — Catalogue e-learning par niveau G4→G1

**Source de vérité modules**
- Feuilles / fiches TEAM-GP (codes type `G48…`, types `e-learning` / `e-test`)  
- Agrégats fiche : ex. KITIO G4 → e-learning **77/77**, e-test **40/40**, « modules en ligne » **117/117**

**Livrable**
| Niveau Toyota | Nb modules e-learning (obligatoires) | Nb e-tests (si distinct) | Total ligne |
|---------------|--------------------------------------|--------------------------|-------------|
| G4 | *à extraire* | *à extraire* | *à extraire* |
| G3 | … | … | … |
| G2 | … | … | … |
| G1 | … | … | … |

Extraction : script `scripts/extract_teamgp_elearning_catalog.py` sur le classeur harmonisé  
→ `data/toyota/teamgp-elearning-by-level.json` (sans nominatif).

**Règle runtime**
```
requiredElearning(level) = catalog[level].elearningCount
doneElearning(tech)     = from TEAM-GP link OR future API
```

Tant que pas d’API TEAM-GP : pour les **liés MEDACAP**, hydrater depuis export Excel daté ; sinon afficher « catalogue obligatoire » seul (assigné = requis, fait = inconnu).

---

## Phase C — UI PIF détail (4ᵉ card)

Dans `DefineTechnicianKpiCards` (ou équivalent) :

| Card actuelle | Rôle |
|---------------|------|
| À faire | formations Academy PIF |
| En cours | inscrit / en_cours |
| Faites | fait |
| **E-learning Toyota** (nouveau) | `fait / requis` pour le niveau analysé (grade cible ou niveau parcours) |

Niveau retenu (priorité) :
1. Niveau parcours / grade visé Toyota du tech (Excel / futur champ)  
2. Sinon `certLevels.toyota` / niveau MEDACAP mappé G4…G1  
3. Sinon G4 par défaut (début de parcours) — **explicite** dans l’UI

---

## Phase D — UI KI « Résultats Toyota »

À côté de la card maîtrise compétence (Maintenancier / Réparateur / …) :

**Card « E-learning Toyota »**
- KPI filiale : taux moyen e-learning des techs liés  
- Meta : `N techniciens avec suivi e-learning`  
- CTA optionnel : ancre `#toyota-pif` ou détail marque (plus tard)

---

## Phase E — Automatisation

1. Job / script périodique : relecture export TEAM-GP → maj liens + stats e-learning  
2. API MEDACAP ou store local `teamgp-progress` indexé par `medacapUserId`  
3. Portail : `useKiFilialeScope` fusionne `teamgpElearning` dans le LMS (comme `pifTechnicians`)

---

## Hors scope (ne pas mélanger)

- Remplacer le PIF Academy (`TS*`) par le catalogue `G48*`  
- Mettre des DCP Excel dans `cfao-needs`  
- Ouvrir les accès TEAM-GP N+1 dans le front public

---

## Ordre de livraison suggéré

1. ~~Accès détail marque KI~~ (**fait**)  
2. ~~Script match Excel ↔ MEDACAP + file revue~~ (**fait** — 6/6 KI Cameroun liés)  
3. ~~Catalogue counts G4→G1 (JSON)~~ (**fait** — `frontend/src/data/toyota/`)  
4. ~~4ᵉ card PIF (requis catalogue ; fait si link)~~ (**fait** — KI only)  
5. ~~Card e-learning section résultats KI~~ (**fait**)  
6. Pipeline auto d’import TEAM-GP  

---

*Plan aligné étude SI `docs/ETUDE_SI_Suivi_Techniciens_02-09-2026.md`.*
