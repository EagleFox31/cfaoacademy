---
name: commit-moa
description: Write CFAO Academy git commit messages and weekly status commits that feed the automatic Friday MOA report (app 15). Use whenever committing on this repo, writing a commit message, or producing the mandatory weekly status commit. Enforces the NN-x subject + French non-technical "Avancement:" line, and the exact "delivery: statut-hebdo YYYY-Www" section format that the app-15 aggregator parses.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: June 2026
  abstract: Encodes CONTRIBUTING.md commit and weekly-status conventions. Commit content is the raw material for the formal Friday MOA email — it must be factual, in professional French, understandable by non-technical recipients.
---

# Commits & statut hebdo conformes MOA

Source de vérité : [CONTRIBUTING.md](../../../CONTRIBUTING.md). **Ce qui n'est pas dans Git n'apparaît pas dans le mail MOA du vendredi.** Les destinataires (MOA, direction, sponsors) **ne sont pas techniques**.

## When to apply

- À chaque commit significatif d'une story du backlog
- Pour produire le **statut hebdomadaire obligatoire** (au plus tard jeudi soir)
- Avant de pousser, pour vérifier qu'un message alimentera correctement le digest

## Commit de travail (quotidien)

```text
NN-x: résumé court en français (impératif ou passé composé)

Avancement: Une ou deux phrases sur la valeur livrée / l'étape franchie,
compréhensibles par un non-technique (pas de jargon Git, pas de noms de libs).

[Optionnel — technique, pour l'équipe]
- détail 1
- détail 2
```

Règles strictes :
- **`NN-x`** = ID story backlog (`02-3`, `15-5`, `00-4`…), obligatoire en tête de la **première ligne**.
- **`Avancement:`** obligatoire sur tout commit significatif — phrase reprise telle quelle dans le rapport MOA.
- Langue **française** (aligné site + MOA).
- Jamais `fix` / `WIP` / `tmp` seuls : préciser **quoi** et **pourquoi**.
- Co-author / footer projet : ne pas mettre de hash, jargon ou nom de lib dans `Avancement:`.

**Bon**
```text
02-3: téléchargement des attestations PDF

Avancement: Les apprenants peuvent désormais télécharger leurs attestations
depuis leur espace personnel, en français et en anglais.
```

**À éviter**
```text
fix stuff

Avancement: refacto du hook useFoo et bump deps
```

## Statut hebdomadaire (chaque dev actif, avant vendredi)

Un **commit dédié**, sujet exact :
```text
delivery: statut-hebdo YYYY-Www
```
Exemple : `delivery: statut-hebdo 2026-W23` (numéro de semaine ISO).

Corps — **sections exactes** (l'agrégateur app 15 les parse littéralement) :
```text
Avancements:
- Point 1 (phrase complète, ton professionnel — résultat métier, pas liste de fichiers).
- Point 2.

Objectifs-en-cours:
- Objectif du sprint / de la semaine encore ouvert.

Objectifs-semaine-prochaine:
- Priorité 1 pour la semaine à venir.
- Priorité 2.

Goulots:
- Blocage / dépendance (validation IT, accès infra, décision MOA), factuel sans dramatiser.
- « Aucun » si rien à signaler.
```

| Section | Contenu attendu |
|---------|-----------------|
| Avancements | Ce qui a été **livré ou validé** cette semaine (résultat métier) |
| Objectifs-en-cours | Ce qui reste en cours sur la période actuelle |
| Objectifs-semaine-prochaine | Engagement pour la semaine suivante |
| Goulots | Risques/blocages/dépendances externes, factuels |

## Calendrier (rappel)

| Jour | Action |
|------|--------|
| Lundi → jeudi | Commits de travail avec ligne `Avancement:` |
| Jeudi | Email de rappel auto aux devs (compléter le statut hebdo) |
| Vendredi | Email **formel MOA** : synthèse agrégée commits + statuts hebdo |

## Gotchas

- Pousser **avant l'heure d'envoi** configurée (app 15), sinon absent du mail.
- Tester selon la séquence projet **TU → TI → contrat (si API/webhook) → E2E (si parcours)** (cf. `planning.md §6`) — référencer l'ID story rattache au tableau de tests app 15. Voir [[walkthrough-fiche]].
- Le tech lead peut consolider une vue d'équipe (preview vendredi) avant envoi MOA.
