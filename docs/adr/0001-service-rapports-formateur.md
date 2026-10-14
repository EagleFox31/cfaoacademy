# ADR 0001 — Service de rendu des rapports formateur

- **Statut** : remplacé — le service Flask a cédé la place au service détachable
  `cfao-comptes-rendus/` (Django, Keycloak, Cerbos ; story 04-5-1). Les chemins `services/`
  ci-dessous sont ceux de l'époque.
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
   que par la passerelle (`/apercu/*`, `/cr-donnees/*`).
2. Le modèle (`cfao-comptes-rendus/api/rendu/modeles/MODELE-REFERENCES.pptx`) est **versionné** : la production
   d'un rapport ne dépend d'aucun dossier extérieur au dépôt.
3. **Transitoire** : le même service conserve pour l'instant les brouillons (SQLite) et identifie
   l'utilisateur par un en-tête. Ces deux points sortent du service dès que possible (§ Suites).

## Conséquences

- Rendu fidèle au modèle, aperçu réel par page, rapport PPTX ou PDF.
- Une image plus lourde (LibreOffice, ~500 Mo) et une conversion sérialisée par service.
- Tant que l'authentification n'est pas branchée, le service ne doit pas être exposé hors de la
  passerelle et du réseau interne.

## Suites

| Story | Objet |
|---|---|
| `04-5.1` | JWT Keycloak validé par le service, policy Cerbos `compte_rendu` + tests négatifs |
| `04-5.2` | Brouillons dans `cfao-operations` (PostgreSQL) ; le service ne garde que le rendu |
| `04-5.3` | Textes d'interface dans `frontend/src/i18n/` (aujourd'hui `cfao-comptes-rendus/web/src/i18n/`, à créer) |
| `04-5.4` | Parcours E2E formateur sur la stack Compose |
| `04-5.5` | Sessions lues depuis l'API `planning` au lieu du planning de démonstration |

Documentation du module : [MODULE_RAPPORTS_FORMATEUR.md](../MODULE_RAPPORTS_FORMATEUR.md).
