---
name: etude-si
description: >-
  Cadre et analyse un système d'information As-Is (Excel, classeur, export métier)
  puis le normalise vers le SI cible CFAO Academy (Merise MCD/MLD, dry-run, files
  de revue, DCP, urbanisation identity/lms/operations/needs). Use when the user
  asks to study/analyze an information system, cadrer un SI, model Merise/MCD,
  reverse-engineer a spreadsheet as operational SI, prepare a data reprise/import,
  or decide Merise vs UML.
license: MIT
metadata:
  author: CFAO Academy
  version: "1.0.0"
  date: September 2026
  abstract: >-
    Encodes the validated workflow from docs/MERISE_MCD_PARTICIPANTS_2025.md and
    docs/PATRON_IMPORT_TABULAIRE.md — measure before model, fail loudly on
    rejects, never invent data, review queues before Keycloak accounts.
---

# Étude / cadrage d’un SI (As-Is → cible)

Méthode projet pour **étudier un SI opérationnel** (souvent un Excel) et le
rapprocher du SI plateforme. Références vivantes :
[docs/MERISE_MCD_PARTICIPANTS_2025.md](../../../docs/MERISE_MCD_PARTICIPANTS_2025.md),
[docs/PATRON_IMPORT_TABULAIRE.md](../../../docs/PATRON_IMPORT_TABULAIRE.md),
[architecture.md](../../../architecture.md).

## When to apply

- « Analyse ce SI / ce fichier / ce classeur »
- Cadrage Merise (MCD/MLD) ou question Merise vs UML
- Reprise / dry-run / règles de rejet avant écriture DB
- Découpage DCP, ownership (`identity` / `lms` / `operations` / `cfao-needs`)

## Merise vs UML (arbitrage projet)

| Besoin | Outil | Quand |
|--------|-------|-------|
| Structure des données, cardinalités, clés, rejets | **Merise** (MCD → MLD) | **D’abord**, dès l’As-Is |
| Comportement applicatif (parcours, écrans, séquences) | **UML** (use cases, séquences, activités) | **Après** MCD stable + dry-run OK |

Ne pas démarrer UML pour « comprendre le fichier ». UML sert à spécifier
l’application une fois le modèle de données et les règles d’import figés.

## Pipeline obligatoire

```
1. Diagnostic As-Is     → compter, glossaire, ce que le fichier NE dit pas
2. Urbanisation         → ownership plateforme (qui possède quoi)
3. MCD Merise           → entités, associations, cardinalités, DCP
4. Règles de rejet Rn   → écrites AVANT tout script
5. Dry-run (parse ≠ apply) → JSON + report ; exit ≠ 0 si rejet bloquant
6. Files de revue       → humain (collisions, multi-clé, orphelins, états)
7. Collecte id stable   → email / matricule (compte Keycloak)
8. Import réel          → management commands / ops ; UML si besoin UX
```

**Ne jamais écrire en base tant que le dry-run et les files de revue ne sont pas
arbitrés.** Un import qui « réussit » en perdant des lignes est un échec.

## Étape 1 — Diagnostic As-Is (mesurer avant de modéliser)

1. Identifier la **feuille source de vérité** et les vues parasites (ne pas
   double-importer).
2. Définir le grain : *1 ligne = 1 quoi ?* (ex. participation, pas personne).
3. **Compter** volumes réels (lignes, personnes, sessions, vides %, doublons).
4. Figer une **normalisation** (casse, accents, espaces) et recalculer les
   chiffres **avec la même norme**.
5. Cartographier colonnes → concepts ; noter les **commentaires Excel** et
   résidus de formule (`#VALUE!`, `#REF!`).
6. Lister ce que le fichier **ne dit pas** : états, identité stable, rejets,
   base légale DCP — à modéliser explicitement.

Test « ligne vide » = **ligne sans données métier**, jamais un numéro de ligne.

## Étape 2 — Urbanisation (ownership)

Aligner chaque concept sur le découpage `architecture.md` :

| Concept typique | Cible |
|-----------------|-------|
| Personne / apprenant / org / marque | `cfao-core` **identity** |
| Catalogue / code formation | `cfao-core` **lms** |
| Session, présence, séjour, frais, commentaires | **cfao-operations** (Node) |
| Marques, filiales, codes (sans nominatif) | **cfao-needs** référentiel |

**Minimisation** : `cfao-needs` ne reçoit **aucune DCP** (pas de noms, emails,
files de revue). Artefacts versionnables vs `.gitignore` : référentiel OK ;
`entities.json` / `report.json` nominatifs → ignorés.

## Étape 3 — MCD (règles dures)

1. **Séparer les calendriers** distincts (ex. pédagogique ≠ voyage/séjour).
2. **0,1** pour les annexes (séjour, frais) plutôt que colonnes aplaties.
3. **Ne pas inventer de donnée** : garder le montant source + `base ∈ ht|ttc|hors_taxe` ;
   TVA seulement si la source la porte.
4. **Présence / états** : ternaire ou enum **sans DEFAULT** qui masque le vide.
5. **Identité** : PK technique + `username` slug Keycloak ; email/matricule =
   ouverture de compte, **pas** condition d’existence de la personne à l’import.
6. **Collision de slug** = **signal de revue**, pas suffixe `-2` automatique
   (souvent même personne, frontière prénom/nom).
7. Clé provisoire `(nom, prénom, client)` **invente des fantômes** si multi-employeur —
   clusterer sans client, file multi-client à part.
8. Commentaires : `cible` d’abord par **bande de colonnes**, puis texte ; cas
   **orphelin** (commentaire sans ligne data) → revue, pas statut auto.
9. Bloc **DCP** par entité (base légale, rétention, ressource Cerbos).

## Étape 4 — Règles de rejet + dry-run

Suivre le patron [PATRON_IMPORT_TABULAIRE.md](../../../docs/PATRON_IMPORT_TABULAIRE.md) :

- Parse ≠ apply ; rapport exhaustif (erreurs + **tous** les warnings, pas de plafond).
- Rejets bloquants → `status=REJECTED` + **exit code ≠ 0**.
- Warnings (dates illisibles, totaux présents…) → liste complète dans le rapport.
- Sorties typiques : `entities.json`, `cfao_needs_referential.json`, `report.json`,
  `README.md`, puis feuille de revue (`revue_arbitrages.xlsx`).

Scripts de référence participants 2025 :
- `scripts/dryrun_participants_2025.py`
- `scripts/generate_review_sheet.py`
- `cfao-core/.../import_participants_2025.py`
- `cfao-needs/.../import_participants_referential.py`

## Étape 5 — Files de revue (humain)

Avant écriture DB, arbitrer au minimum :

| File | Décision attendue |
|------|-------------------|
| Collisions slug | Fusionner vs 2 personnes (puis `-2` seulement si 2 personnes) |
| Multi-client / multi-employeur | Client de référence + historique |
| Identité incomplète (sans prénom…) | Correction ou rejet |
| Signaux d’état (annul./report) | Statut session réel |
| Orphelins | Rattachement ou mémoire seule |

Puis collecte **email / matricule** pour ouvrir les comptes (règle type R13).

## Checklist qualité (refuser le livrable sinon)

- [ ] Chiffres source = chiffres MCD = chiffres dry-run (écarts explicités)
- [ ] Normalisation figée et reproductible
- [ ] Ce que le fichier ne dit pas est modélisé (états, rejets, DCP, orphelins)
- [ ] Aucune donnée inventée (HT rétro-calculé, statut auto au rendement 0, etc.)
- [ ] Dry-run échoue proprement sur rejets bloquants
- [ ] Warnings complets dans le rapport
- [ ] Ownership plateforme + slice needs sans DCP
- [ ] Files de revue générées ; import réel bloqué tant qu’elles ne sont pas tranchées

## Anti-patterns

| Anti-pattern | Faire plutôt |
|--------------|--------------|
| UML avant MCD pour « comprendre Excel » | Merise d’abord |
| Clé personne = nom+prénom+client | Cluster nom+prénom + file multi-client |
| Suffixe auto sur collision slug | Revue humaine |
| Commentaire texte → statut session global | Cible par bande de colonnes |
| Import « OK » en silent-drop | Exit ≠ 0 + rapport |
| Commit de `entities.json` / `report.json` nominatifs | `.gitignore` ; versionner le référentiel needs |
| Confondre `lms.Enrollment` et participation physique | Deux concepts, deux owners |

## Progressive disclosure

- Checklist détaillée : [references/checklist.md](references/checklist.md)
- Exemple validé (participants 2025) : [references/exemple-participants-2025.md](references/exemple-participants-2025.md)
