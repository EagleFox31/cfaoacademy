# Dry-run participants 2025

Généré par `scripts/dryrun_participants_2025.py` — **aucune écriture DB**.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `entities.json` | MLD plateforme (identity / lms / operations) |
| `cfao_needs_referential.json` | Marques, filiales, codes catalogue + volumes par org pour **cfao-needs** |
| `report.json` | Rejets, warnings, files de revue |

## Qui consomme quoi

- **cfao-core identity** : apprenants (username slug), clients, marques, animateurs  
- **cfao-core lms** : formations (codes)  
- **cfao-operations** : sessions, participations, séjours, frais, commentaires  
- **cfao-needs** : référentiel (`Brand`, `OrgUnitRef`) + codes pour aligner campagnes ; les counts par org aident la priorisation — l’historique détaillé reste operations jusqu’au mode `integrated`

## Statut ce run

- status: **REJECTED**
- tuples apprenants: 932 · slugs distincts: 929 · collisions: 3
- R1 (sans N°): 46 · R2 (doublons): 6
- orphelins: 4 · multi-client: 60

Exit code script: **1** si R1 ou R2 > 0, sinon **0**.
