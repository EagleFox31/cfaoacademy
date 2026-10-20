# SI — Participants / Apprenants formations 2025

> Source As-Is : `docs/Liste des participants aux formations 2025.xlsx` (41 colonnes + **14 commentaires** Excel)  
> Règle métier : **stagiaire = technicien participant = apprenant** (`learner` ou `b2b_partner`).  
> Aligné : `architecture.md` · `PLATFORM_ROLES.md` · backlog `00-4` / `00-9`.  
> **v3.4** — v3.3 + collision de slug = **signal de revue** (pas `-2` automatique) ; 3 collisions As-Is = frontière prénom/nom, pas homonymes ; effectif cible à confirmer (**929** si fusion).

---

## 1. Diagnostic As-Is

Le classeur est le **SI opérationnel actuel** de la délivrance formation Academy.  
**1 ligne = 1 participation** d’un apprenant à une session (+ séjour / frais éventuels).  
Ce que le classeur **ne dit pas en colonnes** (états, identité stable, rejets, DCP) est modélisé explicitement — sinon la reprise « réussit » en silence.

### 1.1 Feuilles

| Feuille | Rôle SI |
|---------|---------|
| **Liste stagiaires 2025** | Source opérationnelle (**1 328** participations, **41** champs + commentaires). Le test orphelin est **« ligne sans données »** (pas un n° de ligne) ; la dernière ligne encore peuplée de résidus de formule est la **1342** (`#VALUE!` / `0` / `#REF!` — déjà hors reprise via R1). |
| **Menu déroulant** | Référentiels |
| **Gestion salles de formation** | Demandes / réservations → `operations/rooms` |
| **Feuil1** | Annuaire équipe Academy |
| **Data** | **Autre vue** (pas un sous-ensemble) : **1 129** lignes ; colonnes absentes de la Liste. **Ne pas importer** |
| **Format@ à compléter** | Gabarit — hors reprise |

### 1.2 Normalisation figée (personnes)

```
norm(s) =
  upper(trim(s))
  → NFKD + suppression des diacritiques
  → tout caractère hors [A-Z0-9] → espace
  → collapse espaces
```

| Indicateur | Mesure *(avec `norm` ci-dessus)* |
|------------|----------------------------------|
| Participations | **1 328** |
| Champs utiles | **41** |
| Sessions (`N°` non vide) | **164** |
| Références distinctes (hors vide) | **92** |
| Personnes `(norm(nom), norm(prénom))` | **932** (tuples saisie) |
| Slugs distincts | **929** — **3** collisions (= 3 paires, frontière prénom/nom) |
| Effectif personnes **après revue slug** | **929** si les 3 paires = même individu (à confirmer) ; sinon **930–932** |
| Clés `(nom, prénom, client)` | **1 008** |
| « Personnes » inventées par la mauvaise clé +client | **76** (= 1008 − 932) |
| Individus multi-client | **60** |
| Arrivée Douala | **132** (9,9 %) |
| Frais / total > 0 | **263** |
| Commentaires Excel | **14** (dont **4 orphelins**, §7) |
| `Typ de client` vide | **87,6 %** |
| `Référence` vide | **37,3 %** |
| Sans `N° formation` | **46** (la ligne 1342, résidu de formule, est déjà hors reprise — §1.1) |
| Doublons `(nom, prénom, N°)` | **6** |
| Présence | 1 326 Présent · 1 Absent · 1 vide |
| `nb_heures` | 1 276 numériques · 51 texte |
| Totaux forcés (`origine=saisi`) | ~**20** |

---

## 2. Glossaire

| Terme | Concept SI | Plateforme |
|-------|------------|------------|
| Stagiaire | **Apprenant** (personne) | `learner` / `b2b_partner` |
| Client à une session | Employeur **du moment** | `#id_client` sur PARTICIPATION |
| N° formation | **Session** | `operations/sessions` |
| Référence | **Formation** catalogue | `lms.Course` |
| Dates formation vs arrivée/départ | Deux calendriers | SESSION ≠ SEJOUR |
| Compte rendu oui/non | `compte_rendu_fait` bool | SESSION |
| Présence | ternaire, **sans DEFAULT** | PARTICIPATION |
| Commentaire | `COMMENTAIRE` (+ cas **orphelin**) | operations |
| `username` | Identifiant technique Keycloak (**slug**, sans espace) | seed compte |
| `email` | Login alternatif + ouverture compte (**R13**) | Keycloak « username or email » |
| `telephone` | Contact logistique | attribut identity — **pas** login natif KC |

---

## 3. Urbanisation

```
MÉTIER     Former (CFAO + B2B), séjour, coûts, salles, statuts, DCP
FONCTIONNEL Cataloguer · Planifier · Inscrire · Séjour · Présence · Frais ·
            Commenter (cible colonne) · Statut session · Salles · Reporter
APPLICATIF  Excel → identity · lms · operations/sessions · rooms · analytics
TECHNIQUE   Keycloak + Django + Node + Postgres + Cerbos + rétention
```

---

## 4. Processus & deux calendriers

```
[Planifier] → [Salle?] → [Inscrire + client du moment] → [Séjour?]
  → [tenue | annulee | reportee]  ← statut seulement si signal cible=session
  → [Présence] → [Frais] → [Feedback] → [Commentaires]
```

| Calendrier | Champs |
|------------|--------|
| Pédagogique | Date début / fin formation |
| Séjour | Arrivée / départ Douala |

Soft-check séjour vs pédago **uniquement** si les dates parse (sinon R11).

---

## 5. MCD Merise

### 5.1 Diagramme

```
 FORMATION ──0,1── SESSION (statut, compte_rendu_fait, nb_heures INT)
                      │
                      │ PARTICIPE  (#client, presence NULL)
                      │   0,1 SEJOUR
                      │   0,N LIGNE_FRAIS (montant + base)
                      │   0,N COMMENTAIRE ──?──▶ LIGNE_FRAIS
                      ▼
                 APPRENANT (id PK · username slug · email? · matricule?)
 COMMENTAIRE.cible = session|participation|sejour|frais|orphelin
```

### 5.2 Entités

#### APPRENANT

| Champ | Règle |
|-------|--------|
| `id` | **PK surrogate** — cible de toutes les FK, jamais dérivé d'une donnée métier |
| `nom`, `prenom`, `civilite`, `pays` | Identité civile / **affichage** (source : classeur) |
| `username` | **UNIQUE NOT NULL** — **slug Keycloak** (sans espace), **figé à la création** |
| `email` | UNIQUE NULL — **absent de la source** ; login alternatif + gate compte (**R13**) |
| `matricule` + `#id_client_matricule` | NULL — unique **dans sa filiale émettrice** seulement |
| `telephone` | NULL — **optionnel**, contact logistique ; **pas** un identifiant de login natif Keycloak |

**`username` = identifiant technique Keycloak, pas une clé d’identité métier ni un libellé affiché.**  
Keycloak refuse les espaces par défaut (`username-prohibited-characters`). On n’assouplit pas ce validateur : `JEAN DUPONT` est invalide ; on génère un **slug**.

Corriger une coquille modifie `nom` / `prenom` (affichage), **jamais** `username`. Recalculer le username casserait le lien Keycloak et les habitudes de login.

##### Génération `username` (création uniquement)

```
slug(s) = lower( norm(s) ) avec espaces → '-'     # a-z, 0-9, tirets seulement
                                           # max observé As-Is : 48 car. (limite KC 255)

base = slug(prenom) + '-' + slug(nom)             # ex. jean-dupont
sans prénom (21 personnes)  → base = slug(nom)    # ex. ibrahima
```

**Collision de slug ≠ décision d’homonymie.**  
Sur l’As-Is, les **3** collisions ne sont **pas** deux personnes distinctes : c’est **la même personne** saisie avec la frontière prénom/nom déplacée.

| Slug | Enregistrement A | Enregistrement B |
|------|------------------|------------------|
| `karim-nalougo-soro` | prénom KARIM · nom NALOUGO SORO | prénom KARIM NALOUGO · nom SORO |
| `carlos-daouda-ndiane` | CARLOS · DAOUDA NDIANE | CARLOS DAOUDA · NDIANE |
| `stephane-pierre-ehive-aliman` | STEPHANE PIERRE EHIVE · ALIMAN | STEPHANE PIERRE · EHIVE ALIMAN |

Le tuple `(nom, prénom)` les compte comme 2 ; le slug, en aplatissant la frontière, **révèle le doublon**.

| Étape | Action |
|-------|--------|
| 1 | Collision détectée → **file de revue** (avec les 60 multi-client et 21 sans prénom) — **pas** de second compte |
| 2a | Revue confirme **même personne** → **un** APPRENANT, **un** username (= base), participations fusionnées |
| 2b | Revue confirme **deux personnes** → seulement alors `base-2`, `base-3`… |

**Interdit à l’import auto** : appliquer `-2` dès la collision. Cela créerait deux comptes Keycloak et un historique coupé pour un seul technicien — retour du problème d’identité fragmentée.

Conséquence de comptage : si les 3 paires sont bien 3 individus uniques, l’effectif réel est **929**, pas **932** — **confirmé par la revue**, pas corrigé d’office.
##### Login Keycloak (compte ouvert)

| L’utilisateur tape… | Support |
|---------------------|---------|
| **username** (slug) | Natif |
| **email** | Natif si realm « Login with email » / champ *username or email* (déjà le pattern cfao-needs) |
| **téléphone** | **Pas natif** — pas de login OTP téléphone en v1 ; éventuelle phase 2 (SPI / username = n°) hors scope reprise |

Keycloak exige toujours un `username` unique sur le compte. Email et téléphone ne le remplacent pas : l’email est un *second moyen de se connecter* ; le téléphone reste un attribut de contact.

**Pourquoi `#id_client_matricule`** : l'employeur est porté par PARTICIPATION, pas par APPRENANT. Un technicien qui change de filiale conserve son ancien matricule, lequel n'a de sens que rattaché à son émetteur.

- **Dry-run / 1ʳᵉ passe import** : cluster **`(norm(nom), norm(prénom))`** — les **deux** composantes (pas le nom de famille seul, qui fusionnerait ~122 personnes). → **932** tuples saisie.
- **Interdit** : PK `(nom, prénom, client)` → **1 008** clés, **76** fantômes, **60** multi-client.
- **File de revue identity** (même file) : **60** multi-client · **21** sans prénom · **3** collisions de slug.

##### Remplissage réel à la reprise

Les seuls champs d'identité du classeur sont **Civilité, Noms, Prénoms, Pays** : il n'existe **aucune** colonne e-mail, matricule ou téléphone dans les 41 colonnes.

| Champ | Rempli à l'import |
|-------|-------------------|
| `id`, `username` (slug) | **100 %** — générés |
| `nom` | 1 327 / 1 328 |
| `prenom` | 1 305 / 1 328 (**21** sans prénom) |
| `email`, `matricule`, `telephone` | **0 %** — collecte RH / filiales requise |

#### CLIENT · FORMATION · ANIMATEUR · MARQUE · POLE

Inchangés (clés naturelles §7).

#### SESSION

| Champ | Règle |
|-------|--------|
| `numero` | Unique si non vide |
| `nb_heures` | INT heures — jamais datetime |
| `compte_rendu_fait` | Booléen (`oui`/`non`/`Non`) |
| `statut` | `planifiee` \| `tenue` \| `annulee` \| `reportee` |
| `statut_source` | `commentaire_session` \| `manuel` \| `defaut` |

**Dérivation de `statut` depuis un commentaire — uniquement si `COMMENTAIRE.cible = session`** (voir §5.2 COMMENTAIRE).  
Un texte « annulée » / « reportée » sur une colonne **voyage** ne change **pas** le statut de session.

##### Rendement As-Is de cette dérivation : **zéro**

Vérification bande × ligne data sur les **14** commentaires :

| Bande | Commentaires | Sur ligne data |
|-------|--------------|----------------|
| **session** (D, G) | G1364, G1412 | **aucun** — les deux sont orphelins |
| **sejour** (U–AA) | U183, V209, U210 | 3 |
| **frais** (AB–AL) | AC291, AE282, AK78, AK491, AK498, AK535, AH1526 | 6 (+ AH1526 orphelin) |
| **autre** | P254, O1550 | 1 (+ O1550 orphelin) |

Conséquences sur **ce** fichier (à ne découvrir qu’après bascule serait une faute) :

1. La dérivation commentaire → `SESSION.statut` **ne se déclenche jamais**.
2. Les **164** sessions reçoivent toutes un statut par **défaut**, avec `statut_source=defaut`.
3. **R5 est inopérante à l’import** : aucune session n’est marquée `annulee` automatiquement → le KPI « coût d’annulation » n’a **pas de matière** issue de l’auto-statut, alors que **3 annulations** et **2 reports** sont documentés dans les commentaires.
4. **100 %** de l’information d’état As-Is vit dans la **file de revue manuelle** (orphelins + commentaires séjour/frais à interpréter à la main).

La règle de dérivation **reste juste** et **doit rester** dans le modèle : elle servira aux **saisies futures** (commentaire en colonne D/G sur une ligne rattachée). Sur l’As-Is 2025, son rendement est **nul**.

#### PARTICIPATION

`presence` ∈ {`present`,`absent`,`non_renseigne`} **ou NULL** — **aucun DEFAULT**.  
`#id_client` = employeur du moment.

#### SEJOUR *(0,1, PK = FK participation)*

Voyage Douala ; `nb_nuitees` recalculable **si** dates séjour parsées (sinon pas de recalcul silencieux).

#### LIGNE_FRAIS *(0,N)*

La source **ne porte pas** du HT partout. Mesure :

| Poste | Colonne HT ? | Lignes non nulles / non zéro (ordre) |
|-------|--------------|-------------------------------------|
| hôtel | oui (`Hotèl XAF`) | ~166 |
| navettes | oui (`Navettes XAF`) | ~176 |
| lettre d’invitation | **non** (montant seul) | ~82 |
| déjeuner | **non** | ~261 |
| pressing | **non** | ~121 |
| parking | **non** | ~45 |
| autres | **non** | ~7 |
| visa | **non** | **0** (toutes cellules à 0) |

Modèle :

| Propriété | Règle |
|-----------|--------|
| `poste` | enum postes ci-dessus |
| `montant` | **Tel que dans la source** — on n’invente pas de HT |
| `base` | `ht` \| `ttc` \| `hors_taxe` |
| `taux_tva` | **Nullable** — renseigné **seulement** si `base=ht` et poste ∈ {hôtel, navettes} (défaut 0,1925 si paire TTC présente) |
| `origine` | `saisi` \| `calcule` (totaux forcés ~20 → `saisi`) |
| `a_debiter_filiale` | bool (ex. règle visa en commentaire) |
| `note` | texte |

**Dérivation** : seulement dans le sens où l’info existe (HT→TTC pour hôtel/navettes). **Jamais** TTC/1,1925 pour inventer un HT (visa = débours ; lettre d’invitation = tarif fixe 1500/3000 du référentiel).

**Poste visa** : l’import crée **zéro** `LIGNE_FRAIS` (colonne vide). Le coût métier existe via commentaire orphelin AH1526 → file de revue (`a_debiter_filiale` potentiel), **pas** une ligne à montant 0.

#### COMMENTAIRE

| Propriété | Sens |
|-----------|------|
| `cible` | `session` \| `participation` \| `sejour` \| `frais` \| **`orphelin`** |
| `#id_session` | si rattachable |
| `#id_participation` | si rattachable |
| `#id_ligne_frais` | si `cible=frais` et ligne créée |
| `cellule_source` | ex. `V209` |
| `auteur`, `texte`, `tags` | |
| `revue_manuelle` | bool — **true** si orphelin ou conflit |

##### Étape 1 — `cible` depuis la **colonne** (avant le texte)

| Bandes colonnes (Liste) | `cible` initiale |
|-------------------------|------------------|
| **D** (N° formation), **G** (désignation) | `session` |
| **U–AA** (arrivée → heure/vols départ → **nombre de nuitées**) | `sejour` (portée participation) |
| **AB–AL** (lettres d’invitation → totaux ; y compris **AE** Hôtel TTC) | `frais` |
| Autres hors bandes ci-dessus (ex. **O** Noms, **P** Prénoms, **Q** Pays stagiaires) | `participation` ; défaut `participation` si ligne data |

##### Étape 2 — texte **dans** ce périmètre seulement

| Si `cible` | Effet du texte « annul* » / « report* » |
|------------|----------------------------------------|
| `session` | Peut poser `SESSION.statut` (+ `statut_source=commentaire_session`) |
| `sejour` | Tags séjour / participation (**pas** statut session) — ex. visa refusé = **individuel** |
| `frais` | Note / `a_debiter_filiale` |
| `orphelin` | **Aucun** statut session |

##### Cas **orphelin**

Test opérant : **ligne sans données** (pas de N° session, pas de nom — indépendamment du n° de ligne). Quatre commentaires vérifiés :

| Cellule | Texte (extrait) | Ligne data ? |
|---------|-----------------|--------------|
| **G1364** | Annulé — nombre insuffisant de participants | non |
| **G1412** | Annulée — RCI documents hors délai | non |
| **AH1526** | Frais de visa à débiter à la filiale… | non |
| **O1550** | Reporté pour le 11 au 15 Novembre 2024 | non |

→ `cible=orphelin`, import **pour mémoire**, `revue_manuelle=true`.  
Ils **ne produisent pas** de `SESSION.statut` : plus aucune session identifiable à rattacher.

##### Exemple **M15-2025** (7 participations)

| Cellule | Colonne | `cible` | Texte | Effet |
|---------|---------|---------|-------|--------|
| **V209** | Heure arrivée (V) | `sejour` | annulée — non obtention du visa | **Pas** `session.annulee` — signal individuel |
| **U210** | Arrivée Douala (U) | `sejour` | Reportée 03–07 juin | **Pas** auto-statut session ; tag séjour / revue si ambigu |

Conséquence d’une dérivation **texte seul** : session entière → `annulee` à tort → **7** participations faussées. Avec la dérivation **colonne d’abord**, la session n’est pas annulée automatiquement.

**Annulations / reports « session » sur ce classeur :** **zéro** récupérable automatiquement (bande session ∩ ligne data = ∅). V209 est séjour ; G1364/G1412 sont orphelins. Toute l’info d’état As-Is → **file de revue**.

### 5.3 Contraintes & rejets

| # | Règle | Action |
|---|--------|--------|
| R1 | Pas de `N° formation` (**46** — hors résidu 1342, déjà exclu par le test « ligne sans données ») | REJET participation |
| R2 | Doublon `(apprenant, session)` (6) | REJET doublons (1 ligne gagnante documentée) |
| R3 | Homonymes dry-run **ou collision de slug** | **WARNING → revue** ; `-2` seulement après confirmation « deux personnes » |
| R3b | Collision slug = même individu (frontière prénom/nom) | **Fusion** APPRENANT après revue — un username, pas `-2` |
| R4 | Multi-client même personne | OK via PARTICIPATION.#client |
| R5 | Session `annulee` | Conservée pour audit. **Frais** : conservés s’ils existent. KPI **« coût / technicien formé »** = sessions `tenue` only ; KPI **« coût d’annulation »** = frais liés à `annulee` (après revue). **Sur l’As-Is 2025** : aucune `annulee` auto → R5 ne peuplera le KPI d’annulation **qu’après** traitement manuel de la file de revue. |
| R6 | `nb_heures` datetime / sérial | REJET ou conversion explicite |
| R7 | `compte_rendu_fait` | Booléen normalisé |
| R8 | Fiche APPRENANT sans `email` ni `matricule` | **NON bloquant** — `username` slug toujours générable ; fiche identity **sans compte** |
| **R13** | **Ouverture de compte Keycloak** sans `email` | **BLOQUANT pour le compte uniquement** ; seed KC = `username` (slug) + `email` ; login ultérieur = **username ou email** ; `telephone` non requis pour le compte |
| R9 | Feuille Data | Ne pas importer |
| R10 | Colonne Suivant | Ignorer |
| **R11** | Date début/fin/arrivée/départ **illisible** (texte FR libre : **347** débuts, **93** arrivées mesurés comme non-datetime natifs selon extracteur) | `reject_date_illisible` **ou** WARNING + `date_norm` dans rapport — **pas** de `nb_nuitees` recalculé si parse échec |
| R12 | Commentaire orphelin | Import COMMENTAIRE + file revue — **pas** de statut session |

Dry-run exit ≠ 0 si **R1 / R2** non traités. **R8 n'est plus bloquant** : il conditionne l'ouverture des accès (R13), pas la reprise des données.

---

## 6. MLD

```
SESSION (
  id, numero UNIQUE NULL,
  date_debut, date_fin, lieu, modalite,
  nb_heures INT NULL,
  compte_rendu_fait BOOLEAN NULL,
  statut CHECK (planifiee|tenue|annulee|reportee),
  statut_source,   -- commentaire_session|manuel|defaut
  #id_formation NULL, #id_animateur NULL
)

APPRENANT (
  id,                              -- PK surrogate, cible des FK
  nom, prenom, civilite, pays,     -- affichage
  username UNIQUE NOT NULL,        -- slug KC [a-z0-9-], figé, jamais recalculé
  email UNIQUE NULL,               -- login alternatif + R13 ; 0 % à l'import
  matricule NULL,
  #id_client_matricule NULL,       -- filiale émettrice du matricule
  telephone NULL,                  -- contact ; pas login KC natif ; 0 % à l'import
  UNIQUE (id_client_matricule, matricule)
)

PARTICIPATION (
  #id_apprenant, #id_session,  -- PK
  #id_client,
  presence CHECK (present|absent|non_renseigne) NULL,  -- pas de DEFAULT
  appreciation_formation NULL, appreciation_formateur NULL
)

SEJOUR ( #id_apprenant, #id_session, … vols/dates/heures, nb_nuitees NULL, lieu_accueil )

LIGNE_FRAIS (
  id, #id_apprenant, #id_session,
  poste,
  montant NUMERIC NOT NULL,
  base CHECK (ht|ttc|hors_taxe) NOT NULL,
  taux_tva NUMERIC NULL,          -- seulement hôtel/navettes en ht
  origine CHECK (saisi|calcule),
  a_debiter_filiale BOOLEAN DEFAULT FALSE,
  note NULL
)

COMMENTAIRE (
  id,
  cible CHECK (session|participation|sejour|frais|orphelin),
  #id_session NULL,
  #id_participation NULL,
  #id_ligne_frais NULL,          -- si cible=frais
  cellule_source, auteur, texte, tags,
  revue_manuelle BOOLEAN DEFAULT FALSE
)
```

---

## 7. Mapping Excel → MLD

| Source | Destination |
|--------|-------------|
| Col. 1–20 | CLIENT, FORMATION, SESSION (hors statut auto), APPRENANT, PARTICIPATION |
| Col. 21–27 (U–AA) | SEJOUR ; commentaires → `cible=sejour` |
| Col. 28–38 (AB–AL) | LIGNE_FRAIS : `montant` + `base` (ht si col HT, sinon `ttc` / `hors_taxe`) ; total → audit si forcé |
| Col. 39–40 | Appréciations |
| Col. 41 | Ignorer |
| Commentaires sur **ligne data** | COMMENTAIRE ; **statut session seulement si bande D/G** — **rendement As-Is = 0** |
| Commentaires **orphelins** (G1364, G1412, AH1526, O1550) | `cible=orphelin`, revue — **pas** de statut |
| Gestion salles / Feuil1 | rooms / seed |
| Data | Hors import |

### Inventaire commentaires (14) — effets réels

| Cellule | Colonne / bande | Ligne data ? | `cible` | Produit un `SESSION.statut` ? |
|---------|-----------------|--------------|---------|------------------------------|
| AK78 | frais | oui | `frais` | non |
| U183 | séjour | oui | `sejour` | **non** |
| **V209** | séjour | oui (M15) | `sejour` | **non** (visa individuel) |
| **U210** | séjour | oui (M15) | `sejour` | **non** (pas auto-report session) |
| P254 | prénoms (P) | oui | `participation` | non |
| AE282 | frais | oui | `frais` | non |
| AC291 | frais | oui | `frais` | non |
| AK491, AK498, AK535 | frais | oui | `frais` | non |
| **G1364** | session (G) | **non** | **`orphelin`** | **non** |
| **G1412** | session (G) | **non** | **`orphelin`** | **non** |
| **AH1526** | frais (AH) | **non** | **`orphelin`** | **non** (revue facturation visa) |
| **O1550** | noms (O) | **non** | **`orphelin`** | **non** |

Sur l’As-Is : **aucun** commentaire `cible=session` sur ligne data → **zéro** dérivation de statut. Les 3 annulations / 2 reports connus n’existent que dans la **file de revue**. La règle reste pour les saisies futures.

### Clés d’import

| Objet | Clé |
|-------|-----|
| FORMATION | `(pole, marque, code)` |
| SESSION | `numero` |
| APPRENANT | **1ʳᵉ passe** : cluster `(norm(nom), norm(prénom))` + détection collisions **slug** → revue. **Après collecte** : `email` > `(id_client_matricule, matricule)`. Suffixe `-2` **uniquement** si revue = deux personnes distinctes |
| PARTICIPATION / SEJOUR / frais | `(id_apprenant, id_session)` |
| COMMENTAIRE orphelin | `(cellule_source)` |

---

## 8. Mapping plateforme

| Entité | Possède |
|--------|---------|
| APPRENANT + DCP | identity |
| FORMATION | lms |
| SESSION, PARTICIPATION, SEJOUR, LIGNE_FRAIS, COMMENTAIRE | operations/sessions |
| DEMANDE_SALLE | operations/rooms |
| KPI formés / coûts | analytics — hors `annulee` pour « formé » ; coût d’annulation séparé (R5) |

`lms.Enrollment` ≠ `PARTICIPATION`.

---

## 9. DCP (rappel)

~**932** tuples saisie / jusqu’à **929** personnes après revue slug ; part B2B ; SEJOUR / LIGNE_FRAIS = accès restreint ; ressources Cerbos distinctes ; rétention séjour ≤ pédagogique si possible. Gate juridique avant bascule identity.

| Champ identity | Dans la source | À collecter |
|----------------|----------------|-------------|
| `nom`, `prenom`, `civilite`, `pays` | oui | — |
| `username` | slug dérivé (sans espace) | seed Keycloak |
| `email` | non | RH / filiales — **R13** + login « username or email » |
| `matricule` | non | filiales — + `#id_client_matricule` |
| `telephone` | non | **optionnel** — contact séjour ; pas login KC v1 |

`email`, `matricule` et `telephone` : même finalité formation — registre DCP unique. Le téléphone n’ouvre pas de compte à lui seul.

---

## 10. Qualité & pièges

| Point | Traitement |
|-------|------------|
| Mauvaise clé +client | +**76** fantômes — interdite |
| 46 sans N° / 6 doublons | R1 / R2 |
| Dates texte FR | **R11** — pas de nuitées magiques |
| `nb_heures` | R6 |
| Présence | Pas de DEFAULT `present` |
| Frais HT inventé | Interdit — `base` explicite |
| Visa colonne | 0 ligne ; AH1526 orphelin → revue |
| Orphelins G1364… | Mémoire + revue, pas statut |
| M15 V209/U210 | Cible séjour — ne pas annuler la session |
| Data | Hors import |
| Username avec espace | **Interdit** côté Keycloak — toujours slug |
| Collision slug | **Revue** d’abord (3 cas As-Is = même personne) — pas `-2` auto |

---

## 11. Cas d’usage

Assistante : import + file **revue orphelins** + conflit commentaires.  
Formateur : présence explicite.  
Finance : frais tenus vs **coût d’annulation** ; visa à débiter (revue).  
RH : historique par `id` (affichage **nom/prénom**) ; login = **username** slug et/ou **email** ; fournit `email` / `matricule` / `telephone` ; arbitre la file identity : **60** multi-client + **21** sans prénom + **3** collisions slug.

---

## 12. Synthèse

> **v3.4** : slug Keycloak OK ; login = **username | email** ; collision de slug = **signal de revue** (révèle doublons de frontière prénom/nom), pas création de `*-2`.  
> Effectif : **932** tuples → potentiellement **929** personnes après revue des 3 paires.  
> Gate **reprise** : **R1 / R2 / R11** + file orphelins/état + **file identity** (multi-client, sans prénom, collisions slug).  
> Gate **accès** : **R13** (`email`).

### Suite

1. Collecte `email` / `matricule` / `telephone`.  
2. **Dry-run** : `py -3 scripts/dryrun_participants_2025.py` → `docs/dryrun_participants_2025/`  
   - plateforme : `entities.json`  
   - **cfao-needs** : `cfao_needs_referential.json` (marques, filiales, codes + volumes par org)  
3. Revue RH : collisions slug + multi-client + orphelins/état.  
4. Modèles operations + seed référentiel needs + Cerbos DCP.
