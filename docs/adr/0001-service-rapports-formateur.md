# ADR 0001 — Service de rendu des rapports formateur

- **Statut** : accepté (transitoire)
- **Date** : 2026-09-28
- **Story** : `04-5` — rédiger un rapport post-formation

## Contexte

Les rapports post-formation doivent sortir **identiques** aux comptes rendus PowerPoint déjà
produits par les formateurs (modèle CFAO, tableaux Excel embarqués, graphiques). Le formateur
doit voir chaque page telle qu'elle sera imprimée pendant qu'il la remplit.

L'architecture cible ([architecture.md](../../architecture.md)) répartit le métier entre
`cfao-core` (Django) et `cfao-operations` (Node), derrière la passerelle, avec Keycloak et Cerbos.
Aucun de ces services n'embarque de quoi convertir un PPTX en image.

## Décision

1. Le rendu vit dans un **service technique Python** (`services/`, Flask), qui remplit le modèle
   PowerPoint versionné et le convertit avec **LibreOffice**. Il est packagé comme les autres
   services (`services/Dockerfile`, service `rapports` du `docker-compose.yml`) et n'est joignable
   que par la passerelle (`/apercu/*`).
2. Le modèle (`services/apercu/modeles/MODELE-REFERENCES.pptx`) est **versionné** : la production
   d'un rapport ne dépend d'aucun dossier extérieur au dépôt.
3. Les **brouillons** ne sont pas dans ce service : ils vivent dans `cfao-operations` (ops-db,
   JWT Keycloak, Cerbos `trainer_report`) depuis la story `04-5.2`. Le service de rendu ne garde
   que des ressources techniques (photos, cache d'images).

## Conséquences

- Rendu fidèle au modèle, aperçu réel par page, rapport PPTX ou PDF.
- Une image plus lourde (LibreOffice, ~500 Mo) et une conversion sérialisée par service.
- Le service valide lui-même le jeton et consulte Cerbos (04-5.1) ; il reste derrière la passerelle,
  qui lui transmet le jeton réinjecté par le BFF.

## Suites

| Story | Objet |
|---|---|
| `04-5.1` ✅ | JWT Keycloak validé par le service, policies Cerbos `trainer_report` et `report_rendering` + tests négatifs, BFF actif |
| `04-5.2` ✅ | Brouillons dans `cfao-operations` (PostgreSQL) ; le service ne garde que le rendu |
| `04-5.3` | Textes d'interface dans `frontend/src/i18n/` |
| `04-5.4` | Parcours E2E formateur sur la stack Compose |
| `04-5.5` | Sessions lues depuis l'API `planning` au lieu du planning de démonstration |

Documentation du module : [MODULE_RAPPORTS_FORMATEUR.md](../MODULE_RAPPORTS_FORMATEUR.md).
