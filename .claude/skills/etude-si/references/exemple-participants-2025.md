# Exemple validé — Participants formations 2025

Cas de référence : reprise du classeur
`docs/Liste des participants aux formations 2025.xlsx`.

Livrable modèle : `docs/MERISE_MCD_PARTICIPANTS_2025.md` (v3.4+).  
Dry-run : `scripts/dryrun_participants_2025.py` → `docs/dryrun_participants_2025/`.  
Revue : `scripts/generate_review_sheet.py` → `revue_arbitrages.xlsx`.

## Ce que le cas a prouvé

1. **Le classeur est le SI As-Is** — 1 ligne = 1 participation (+ séjour/frais).
2. **Clé (nom, prénom, client)** invente ~76 fantômes ; clusterer sans client.
3. **3 collisions de slug** = même personne (frontière prénom/nom), pas
   homonymes → revue, pas `-2`.
4. **Dérivation commentaire → SESSION.statut** : rendement As-Is = **0**
   (commentaires session orphelins) ; l’info d’état vit dans la file de revue.
5. **Cible commentaire** = bande de colonnes d’abord (sinon 7 participations
   annulées à tort sur M15-2025).
6. **Frais** : seuls hôtel/navettes ont du HT ; les autres postes gardent le
   montant source + `base`.
7. **R1 = 46** (pas 47) : résidu formule ligne 1342 déjà hors « ligne data ».
8. **Dry-run REJECTED** (46+6) avec 453 warnings complets = comportement attendu.
9. **cfao-needs** : marques + org + codes + counts — zéro nominatif.

## Chiffres de vérité (post-normalisation)

| Indicateur | Valeur |
|------------|--------|
| Lignes data | 1 327 (dry-run) / 1 328 doc si on compte autrement — s’aligner sur dry-run |
| Participations acceptées | 1 275 |
| Tuples personnes | 932 |
| Slugs distincts | 929 |
| Sessions | 164 |
| Revue | 3 + 60 + 21 + 6 + 4 = 94 |

## Séquence d’import (après revue)

1. Remplir `revue_arbitrages.xlsx` → `decisions.json`
2. Collecte email / matricule (R13)
3. `import_participants_2025 --dry-run` (cfao-core)
4. `import_participants_referential --dry-run` (cfao-needs)
5. Import réel ; sessions/participations → `cfao-operations` (Node) hors Django core
