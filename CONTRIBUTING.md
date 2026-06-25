# CFAO Academy — Guide de contribution (équipe build)

Ce document s’adresse aux développeurs et à l’équipe technique. Il couvre les **conventions Git** et la **rédaction des messages** alimentant le **rapport hebdomadaire MOA** (app 15 — envoi automatique le **vendredi**).

> Les destinataires du rapport (MOA, direction, sponsors) **ne sont pas techniques**. Le contenu des commits sert de matière première : il doit être **compréhensible**, **factuel** et **formulé en français professionnel**.

---

## 1. Calendrier hebdomadaire

| Jour | Action |
|------|--------|
| **Lundi → jeudi** | Commits de travail avec ligne `Avancement:` (cf. §2) |
| **Jeudi** *(créneau configurable)* | **Email de rappel** automatique aux devs : compléter le **statut hebdo** (§3) avant vendredi |
| **Vendredi** *(créneau configurable)* | **Email formel MOA** : synthèse agrégée des commits + statuts hebdo de la semaine |

**Important :** ce qui n’est pas renseigné dans Git **n’apparaît pas** dans le mail vendredi. Pensez à pousser vos commits (ou le statut hebdo) **avant l’heure d’envoi** configurée dans l’app 15.

---

## 2. Commits de travail (quotidiens)

### Format

```text
NN-x: résumé court en français (impératif ou passé composé)

Avancement: Une ou deux phrases décrivant la valeur livrée ou l’étape franchie,
            compréhensibles par un non-technique (éviter jargon Git, noms de libs).

[Optionnel — technique, pour l’équipe]
- détail 1
- détail 2
```

### Règles

- **`NN-x`** = ID story backlog (`02-3`, `15-5`, `00-4`…). Obligatoire en début de **première ligne** (sujet).
- **`Avancement:`** = phrase(s) reprise(s) dans le rapport MOA. **Obligatoire** sur les commits significatifs de la semaine.
- Pas de « fix », « WIP », « tmp » seul dans le sujet — préciser **quoi** et **pourquoi**.
- Langue : **français** (aligné site et MOA).

### Exemples

**Bon**

```text
02-3: téléchargement des attestations PDF

Avancement: Les apprenants peuvent désormais télécharger leurs attestations
depuis leur espace personnel ; le parcours est disponible en français et en anglais.
```

**À éviter**

```text
fix stuff

Avancement: refacto du hook useFoo et bump deps
```

---

## 3. Statut hebdomadaire (obligatoire avant le vendredi)

En plus des commits quotidiens, **chaque développeur actif** pousse **un commit dédié** au plus tard **jeudi soir** (après le mail de rappel si besoin).

### Sujet

```text
delivery: statut-hebdo YYYY-Www
```

Exemple : `delivery: statut-hebdo 2026-W23`

### Corps (sections exactes — l’agrégateur app 15 les parse)

```text
Avancements:
- Point 1 (phrase complète, ton professionnel).
- Point 2.

Objectifs-en-cours:
- Objectif du sprint / de la semaine encore ouvert.

Objectifs-semaine-prochaine:
- Priorité 1 pour la semaine à venir.
- Priorité 2.

Goulots:
- Blocage ou dépendance (ex. validation IT, accès infra, décision MOA).
- Laisser « Aucun » si rien à signaler.
```

### Bonnes pratiques

| Section | Contenu attendu |
|---------|-----------------|
| **Avancements** | Ce qui a **été livré ou validé** cette semaine (résultat métier, pas liste de fichiers) |
| **Objectifs-en-cours** | Ce qui reste en cours sur la période actuelle |
| **Objectifs-semaine-prochaine** | Ce que l’équipe s’engage à viser la semaine suivante |
| **Goulots** | Risques, blocages, dépendances externes — **sans dramatiser**, factuel |

Le **tech lead** peut consolider une vue d’équipe dans l’app 15 (preview vendredi) avant envoi MOA.

---

## 4. Ce que reçoit le MOA (vendredi)

Email **formel et professionnel** — ton institutionnel, pas de jargon technique ni de hash de commit dans le corps visible.

Structure type :

1. **Objet** — `CFAO Academy — Point d'avancement projet, semaine du JJ/MM au JJ/MM YYYY`
2. **Formule d’appel** — Madame, Monsieur,
3. **Synthèse** — paragraphe d’introduction (avancement global, jalons)
4. **Avancements de la semaine** — agrégation des lignes `Avancement:` + section `Avancements:` des statuts hebdo
5. **Objectifs en cours**
6. **Objectifs de la semaine prochaine**
7. **Points de vigilance / goulots d’étranglement**
8. **Formule de politesse** — Cordialement, …

Les détails techniques (liste de commits, auteurs, modules touchés) restent en **annexe** ou dans l’**historique app 15**, pas dans le corps principal du mail MOA.

---

## 5. Rappel automatique aux devs (jeudi)

Le module `delivery` envoie un email aux **auteurs Git mappés** + comptes `build_team` :

- **Objet** — `Rappel — statut hebdomadaire CFAO Academy (rapport MOA vendredi)`
- **Contenu** — rappel des sections §2 et §3, lien vers ce fichier, heure limite de push avant envoi vendredi

Configurable dans l’app 15 (jour/heure du rappel, liste complémentaire).

---

## 6. Tests & Definition of Done

Chaque story livrée respecte la séquence documentée dans `planning.md` §6 :

**TU → TI → contrat (si API/webhook) → E2E (si parcours utilisateur)**

Référencer l’ID story dans les commits permet de rattacher le travail au backlog et au tableau de tests app 15.

---

## 7. Références

- Backlog & stories : `backlog.md`
- App pilotage & digest : `PLATFORM_APPS.md` §15, `architecture.md` §5.4 bis
- Planification : `planning.md`
