# Directives pour les Agents IA (AGENTS.md)

## 1. RÈGLE STRICTE : INTERDICTION D'OUVRIR LE NAVIGATEUR

> **ATTENTION AGENTS : NE JAMAIS OUVRIR LE NAVIGATEUR OU DE SOUS-AGENT NAVIGATEUR.**
>
> - **Interdiction absolue** d'appeler l'outil `browser_subagent` ou toute commande ouvrant un navigateur headless/CDP.
> - L'utilisateur fait tourner le serveur de développement local (`npm run dev`) et visualise ses modifications directement dans son propre navigateur en temps réel via le Hot Module Replacement (HMR).
> - **Méthode de validation autorisée** : exécuter `npm run build` dans `frontend/` (ou les tests unitaires/linters) en ligne de commande. Ne jamais tenter d'ouvrir une page web ou de manipuler le navigateur.

---

## 2. Principes & Conventions Frontend CFAO Academy

- **Réutiliser avant de dupliquer** :
  - Toute UI doit réutiliser `PvCard`, `PreviewSection`, `.pv-grid`, `.portal-status-chip`.
  - Pas de cartes ad-hoc ou styles custom redondants.
- **Colorimétrie & Statuts** :
  - Pastilles de statut (`portal-status-chip`) :
    - `done` : vert (`#1aab5b`)
    - `progress` : orange / ambre (`#996600` / `#fff3cc`)
    - `open` : bleu (`#1a56db`)
    - `closed` / `cloture` : noir (`#0e1126`) avec texte blanc (`#ffffff`)
    - `todo` : gris neutre
  - Paliers MEDACAP : Junior (bleu `#1a56db`), Senior (orange `#e67e00`), Expert (vert `#1aab5b`).
- **Liens & CTAs dans les cartes** :
  - Ne pas ajouter de flèche `→` manuelle dans les chaînes de caractères de `cta` car `PvCard` génère déjà la flèche automatiquement (évite les doubles flèches `→ →`).

---

## 3. Modèle Métier & Évaluations : Groupes Fonctionnels (GF) et Transposabilité Inter-Marques

> **RÈGLE ARCHITECTURALE FONDAMENTALE (À CONSERVER DANS TOUTES LES SESSIONS) :**

1. **L'unité d'évaluation réelle est le Groupe Fonctionnel (GF / Spécialité)** :
   - Le socle de compétences repose sur un référentiel de **Groupes Fonctionnels** (29 spécialités au total : *Arbre de transmission, Moteur Diesel, Freinage, Boîte de vitesses, Électricité, Climatisation, Hydraulique, etc.*).
   - Un véhicule ou une typologie d'engin a certaines spécialités que d'autres n'ont pas (ex. *arbre de transmission* présent sur certains poids lourds/utilitaires et absent sur d'autres).
2. **Matrice Marque × Palier (Niveau)** :
   - Les Groupes Fonctionnels sont mappés **par marque et par niveau** :
     - **Junior (Maintenance)**
     - **Senior (Réparation)**
     - **Expert (Diagnostic)**
   - Une marque au niveau Maintenance n'a pas le même nombre de groupes fonctionnels qu'au niveau Réparation ou Diagnostic.
   - Les GF évaluables par marque/palier sont régis par `supportedGroups` (vs `groups` non supportés) dans `nonSupportedGroupsByBrandLevel` / `vehicles`.
3. **Transposabilité inter-marques & Calcul des notes** :
   - Lorsqu'un technicien compose, **il est évalué sur les groupes fonctionnels** et non sur la marque en vase clos.
   - Les résultats étant atomiques par spécialité/GF, **on peut calculer et projeter la note de ce technicien sur une autre marque** grâce à la correspondance des groupes fonctionnels partagés entre ces marques pour un niveau donné.

---

## 4. RÈGLE STRICTE DE COMMUNICATION : INTERDICTION ABSOLUE DU LATEX

> **ATTENTION AGENTS : NE JAMAIS UTILISER DE SYNTAXE LATEX DANS LES RÉPONSES.**
>
> - **Interdiction absolue** d'utiliser des symboles dollar (`$`, `$$`), balises LaTeX (`\text{}`, `\frac{}{}`, `\times`, `\sum`, `\min`, etc.).
> - L'interface de discussion de l'utilisateur n'interprète pas le LaTeX et affiche le code brut sous forme de charabia illisible.
> - **Toujours formuler les formules mathématiques et calculs en texte clair, standard et lisible** :
>   - Exemple autorisé : `Moyenne = (Note Junior + Note Senior + Note Expert) / 3`
>   - Exemple autorisé : `Score = Note la plus basse entre Théorie et Pratique`

---

## 5. RÈGLE MÉTIER : MOYENNE DES ÉQUIPES PAR MARQUE (PORTAIL DPS & MANAGER)

> **DÉCISION DIRECTION / MÉTIER ("LE BOSS") :**
>
> - Le score global affiché pour une marque est **la moyenne arithmétique simple ("normale")** des paliers évalués (Junior / Maintenance, Senior / Réparation, Expert / Diagnostic).
> - **Ce n'est PAS la moyenne pondérée par l'effectif des techniciens**.
> - Formule :
>   - Si les 3 paliers sont évalués : `(Moyenne Junior + Moyenne Senior + Moyenne Expert) / 3`
>   - Si seuls 2 paliers sont évalués : `(Moyenne Palier 1 + Moyenne Palier 2) / 2`
>   - Les paliers sans évaluation sont ignorés du dénominateur.

---

## 6. STANDARD D'INGÉNIERIE RAIDER ET MÉMOIRE DES ERREURS

- Toute évolution non triviale suit [RAIDER.md](RAIDER.md) : Reusable, Agnostic, Idempotent, Durable, Engineering-grade, Retroactive. Elle se valide avec sa Definition of Done.
- **Avant** : lire la synthèse de [docs/engineering/lessons-learned.md](docs/engineering/lessons-learned.md), puis faire la recherche reuse-first (Adopt / Adapt / Learn / Build).
- **Après** toute erreur ou near miss : y ajouter une entrée avec cause racine, prévention vérifiable et leçon généralisée. En cas de récidive, renforcer le contrôle.
- Toute exception à RAIDER est justifiée dans le walkthrough ou la PR.
