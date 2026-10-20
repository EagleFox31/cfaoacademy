# Pipeline d'Ingestion & Normalisation des Formations CFAO Academy (2026)

Ce dossier contient le pipeline complet et reproductible permettant d'extraire, de normaliser et d'ingérer l'ensemble des fichiers de référence de formation en base de données.

---

## 1. Fichiers Sources Traités

| Fichier Source | Format | Périmètre & Description |
| :--- | :--- | :--- |
| `Catalogue de Formation Technique Carrosserie 2026.pdf` | PDF | 9 modules Carrosserie (`01N1` à `02N3`, Junior / Senior / Expert). |
| `Catalogue_de_Formation_Process_SAV_PART_MOBILITY_2026.docx` | DOCX | 20 modules Process SAV & Pièces VL (`TSKR01`, `FO01`..`FO06`, `TP01`..`TP03`, `SPC01`, `PART01`, `TM01`..`TM05`). |
| `Catalogue_de_Formation_Process_SAV_PART_EQUIPMENT_2026.docx` | DOCX | 7 modules Process SAV & Pièces PL/Engins (`FO01`..`FO06`, `PART01`). |
| `Liste des Formations Motors & Equipment 2026.xlsx` | XLSX | Planning initial de 182 sessions 2026 (Toyota, Hino, Sinotruk, Renault Trucks, JCB, LOVOL, etc.). |
| `Classeur1-Mises a jour prog suzuki aout 2026.xlsx` | XLSX | **Priorité Absolue** : 25 sessions officielles Suzuki révisées en Août 2026 (substituées au planning de Mars). |
| `Thématiques de Formations Non Choisies Motors et Equipment.xlsx` | XLSX | 42 modules non retenus lors de l'arbitrage du 06/02/2026. |
| `Clé de Répartition + Formation 2026 par Pays... (Equipment).xlsm` | XLSM | Matrice des quotas, effectifs techniciens et attributions Equipment par filiale. |
| `Copie de Clé de Répartition + Formation par pays... (Motors) 2026.xlsm` | XLSM | Matrice des quotas, effectifs techniciens et attributions Motors par filiale. |
| `academix.dump` | Dump PostgreSQL | Base historique Academix restaurée (851 besoins, 404 formations, 392 attributions techniciens). |

---

## 2. Architecture des Données

```
  [Fichiers Bruts]                [JSON Normalisés]                  [Bases PostgreSQL]
  DOCX, PDF, XLSX, XLSM  ──▶  data/normalized/*.json  ──▶  needs-db / core-db / ops-db / academix
```

### Données normalisées (`data/normalized/`)
- `courses_catalog_2026.json` : Master catalogue de 129 formations (Carrosserie, Process SAV, Techniques constructeurs).
- `planned_sessions_2026.json` : 180 sessions de formation consolidées (155 hors-Suzuki + 25 Suzuki d'Août 2026).
- `branch_quotas_2026.json` : 494 lignes de quotas par pays et par marque (techniciens atelier, besoins, attributions).
- `course_allocations_by_country_2026.json` : 470 attributions de formations par pays.
- `themathiques_non_choisies_2026.json` : 42 modules non retenus avec statut.

### Schémas de Base de Données

#### 1. `cfao-needs-needs-db-1` (Base `needs`)
- `campaigns_campaign` : Campagne historique 2026 au statut **`ARBITRATED`** (`id='20260000-0000-0000-0000-000000002026'`).
- `campaigns_catalogline` : 129 formations référencées pour l'exercice 2026 avec code, famille et niveau.
- `campaigns_branchbrandquota` : Clé de répartition complète (effectifs atelier, besoins demandés, places attribuées).
- `campaigns_courseallocation` : Détail des places attribuées par formation et par pays.
- `campaigns_trainingsession` : 180 sessions planifiées 2026 avec dates, lieux, formateurs et types.
- `campaigns_coursenonchoisie` : Archive des 42 formations non retenues.

#### 2. `cfaoacademy-core-db-1` (Base `core`)
- `lms_course` : 123 cours publiés pour la plateforme pédagogique LMS.
- `lms_module` : 122 briques pédagogiques e-learning rattachées aux cours.

#### 3. `cfaoacademy-ops-db-1` (Base `ops`)
- `training_session` : 180 sessions d'entraînement opérationnelles pour le suivi des plannings.

#### 4. PostgreSQL `academix` (Base `academix`)
- Base historique complète restaurée depuis `academix.dump` pour l'analytique et l'audit N-1.

---

## 3. Règles Métiers Clés Appliquées

1. **Règle d'Or Suzuki (Août 2026)** :
   La version d'Août 2026 issue de `Classeur1-Mises a jour prog suzuki aout 2026.xlsx` (25 sessions, intégration du Skills Contest, sessions SSAT et report des sessions Gold en fin d'année) a **priorité absolue** sur le calendrier de Mars 2026. Les 27 sessions Suzuki de Mars ont été automatiquement purgées et remplacées.
2. **Statut de Campagne `ARBITRATED`** :
   La campagne 2026 est enregistrée avec `status = 'ARBITRATED'`, garantissant qu'elle ne reçoit plus de nouvelles soumissions et sert de base de référence arbitrée.
3. **Idempotence Totale** :
   Tous les scripts utilisent `ON CONFLICT DO UPDATE` ou des UUID déterministes. Ils peuvent être réexécutés indéfiniment sans créer de doublons ni d'erreurs.

---

## 4. Guide d'Exécution

### Étape 1 : Ré-extraire et régénérer les JSON
```powershell
py -3 scripts/ingestion/extract_all_sources.py
```

### Étape 2 : Ré-ingérer dans les bases PostgreSQL
```powershell
py -3 scripts/ingestion/ingest_to_postgres.py
```

---

## 5. Requêtes SQL de Contrôle Utiles

### Vérifier les campagnes et leurs statuts
```sql
-- Dans needs-db
SELECT year, label, status FROM campaigns_campaign ORDER BY year DESC;
```

### Vérifier le planning Suzuki faisant foi
```sql
-- Dans needs-db ou ops-db
SELECT code, title, location, start_date, end_date, trainer, version_source
FROM campaigns_trainingsession
WHERE brand = 'Suzuki'
ORDER BY start_date;
```

### Vérifier les quotas filiales d'un pays (ex. Cameroun ou Côte d'Ivoire)
```sql
-- Dans needs-db
SELECT brand, total_branch_techs, requested_needs, allocated_seats
FROM campaigns_branchbrandquota
WHERE country = 'CAMEROUN' AND pole = 'MOTORS'
ORDER BY brand;
```

### Consulter l'historique Academix N-1
```sql
-- Dans la base academix
SELECT count(*) as total_besoins_historiques FROM planification_besoins;
```
