# App 16 · Recueil des besoins de formation — spécification

> **Module détachable.** Se déploie seul (`docker-compose.needs.yml`), fonctionne seul, se raccorde
> ensuite à la plateforme sans réécriture. Travail **parallèle** au chemin critique CFAO Academy —
> voir `planning.md` §2 nœud **N**.
>
> Campagne cible : **exercice 2027**, collecte ouverte en 2026.
> Remplace le recueil Academix (`planification_besoins`) et le classeur HTML autonome.

---

## 1. Pourquoi ce module existe

Chaque année, le centre de formation doit savoir **avant l'exercice** combien de collaborateurs
chaque filiale veut former, sur quelles formations, à quel trimestre et à quel endroit. C'est
l'entrée du budget formation et de l'ouverture des sessions.

Trois raisons de le sortir du chemin critique plateforme :

1. **Le calendrier ne se négocie pas.** La collecte 2027 doit partir avant que le LMS (nœud D) ou
   le module sessions (nœud E) ne soient livrés. Attendre la plateforme ferait sauter une campagne.
2. **Le périmètre est fermé.** Auth + référentiel + grille de saisie + emails. Aucune dépendance au
   LMS, aux compétences, aux certifications.
3. **C'est un banc d'essai utile.** Les patrons validés ici — import tabulaire, emailing asynchrone,
   PEP Cerbos default-deny — sont ceux du reste de la plateforme, éprouvés sur un périmètre réduit.

### Ce que le module ne fait pas

Pas de gestion de session, pas d'inscription nominative, pas de logistique voyage, pas de
compétences. Il produit un **plan de besoins consolidé** ; l'ouverture des sessions reste au nœud E.

---

## 2. Détachabilité — le contrat

Le module tourne dans deux modes, **même code, même image**, deux fichiers Compose.

| | Mode `standalone` (R0) | Mode `integrated` (après go-live plateforme) |
|---|---|---|
| Identité | Keycloak embarqué, realm `cfao-needs` | Keycloak plateforme, realm `cfao` |
| Autorisation | Cerbos embarqué, policies `needs_*` | Cerbos plateforme, mêmes policies |
| Base | `needs-db` dédiée | `needs-db` dédiée (inchangé) |
| Référentiel formations | Table locale `catalog_line`, alimentée par import | Synchronisée depuis `lms.Course` via job |
| Org / filiales | Table locale `org_unit_ref`, alimentée par import | Synchronisée depuis `identity.OrgUnit` |
| Emails | Worker embarqué | Worker embarqué (canal plateforme optionnel) |
| Front | SPA servie par la gateway du module | Montée dans le portail comme app 16 |

**Règle d'or :** le passage d'un mode à l'autre se fait par **variables d'environnement**, jamais par
modification de code. Toute dépendance à la plateforme passe par une interface (`ReferentialSource`,
`IdentityProvider`) avec deux implémentations — locale et distante.

### Topologie Docker (mode standalone)

```
                 ┌──────────────────┐
      login      │  needs-keycloak  │  realm cfao-needs (config-as-code)
   ┌────────────▶│  + kc-db         │
   │             └──────────────────┘
┌──────┐   JWT   ┌──────────────────┐
│ SPA  │────────▶│  needs-gateway   │  nginx + oauth2-proxy (BFF, cookie httpOnly)
└──────┘         └────────┬─────────┘
                          ▼
              ┌───────────────────────┐      ┌──────────────┐
              │  needs-api (Django)   │─────▶│ needs-cerbos │
              │  + needs-db (Postgres)│      └──────────────┘
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │  needs-worker         │  Django-Q2 (broker = Postgres, pas de Redis)
              │  emails + planifié    │
              └───────────────────────┘
```

Sept conteneurs, aucun service partagé avec la plateforme. `docker compose -f
docker-compose.needs.yml up` doit suffire, sur une machine vierge, sans le reste du dépôt.

---

## 3. Référentiel 2027

### 3.1 Ce qui a changé depuis Academix

| Dimension | Academix (2026) | Recueil 2027 |
|-----------|-----------------|--------------|
| Axe principal | Pôle (`Motors` \| `Equipment`) | **Famille de catalogue** — 7 familles + Yamaha à venir (§3.2) |
| Pôle | `Motors` \| `Equipment` | `MOBILITY` \| `EQUIPMENT` \| `CARROSSERIE` \| `AUTRE` — **porté par la famille** |
| Marque | groupée (Stellantis) | **éclatée** — 20 marques + YAMAHA, **nullable** pour les lignes transverses |
| Public cible | absent | **niveau technicien** (`JUNIOR`/`SENIOR`/`EXPERT`) + **familles de métier** (manager, front, back office) |
| Maille de saisie | 1 formation × 1 trimestre × effectif | **1 formation × 4 trimestres × (effectif + lieu)** |
| Lieu | absent | `CFR` (régional) \| `FILIALE` (local), **par trimestre** |
| Destinataires du mail | le manager, automatiquement | **l'équipe Academy d'abord**, la filiale après validation (§7) |

### 3.2 Familles de catalogue

Le référentiel n'est **pas** une liste de marques : c'est une liste de **familles**, dont certaines
seulement se déclinent par marque. C'est la structure déjà en place dans
`catalogues/training-catalog.json` et dans les BU du site (`frontend/src/data/index.js`).

| Famille | Pôle | Déclinée par marque ? | Correspondance existante |
|---------|------|----------------------|--------------------------|
| **Techniques Motors** | `MOBILITY` | **Oui** — 10 marques | BU `Techniques Motors` |
| **Techniques Equipment** | `EQUIPMENT` | **Oui** — 10 marques | BU `Techniques Equipment` |
| **Techniques Carrosserie** | `CARROSSERIE` | Non | BU `Techniques Carrosserie` |
| **Process SAV Motors** | `MOBILITY` | **Mixte** — marque ou transverse | `PROCESS_SAV_PARTS_MOTORS / PROCESS_SAV` |
| **Process Parts Motors** | `MOBILITY` | **Mixte** | `PROCESS_SAV_PARTS_MOTORS / PROCESS_PARTS` |
| **Process SAV Equipment** | `EQUIPMENT` | Transverse | `PROCESS_SAV_PARTS_EQUIPMENT / PROCESS_SAV` |
| **Process Parts Equipment** | `EQUIPMENT` | **Mixte** | `PROCESS_SAV_PARTS_EQUIPMENT / PROCESS_PARTS` |
| **Techniques Yamaha** *(moto, moteur marine)* | `AUTRE` | Oui — YAMAHA | **catalogue à venir** |

> **Les familles Process ne sont pas uniquement transverses.** `TP02` (plateforme de référencement
> des pièces constructeur) est une formation *Process Parts* déclinée sur **dix marques** ;
> `X24017V` est une *Process SAV* propre à MERCEDES ; `FTIR01`, `SPC01` et `SSGF01` sont propres à
> SUZUKI. Modéliser Process comme « sans marque » perdrait ces lignes.

### 3.3 Marques — éclatement Stellantis

**Stellantis n'existe plus comme marque.** Les besoins se déclarent sur les quatre marques qui la
composent, chacune avec son propre catalogue technique :

| Pôle | Marques | N |
|------|---------|---|
| `MOBILITY` | BYD · **CITROEN** · **FIAT** · **JEEP** · MERCEDES · MITSUBISHI · OMODA & JAECOO · **PEUGEOT** · SUZUKI · TOYOTA | 10 |
| `EQUIPMENT` | BT · FUSO · HINO · JCB · KING LONG · LOVOL · RENAULT TRUCKS · SHACMAN · SINOTRUK · TOYOTA FORKLIFT | 10 |
| `AUTRE` | YAMAHA *(catalogue à venir)* | 1 |

**L'éclatement est aussi une nouveauté pour CFAO Academy** : `catalogues/training-catalog.json`
porte encore une clé `STELLANTIS` unique et `catalogues/stellantis/` un dossier unique. Leur
découpage en quatre est une tâche à part entière, partagée entre le module et le site
(story `16-24`).

**La marque « transverse » n'est pas une marque.** Une ligne de catalogue a une marque **ou n'en a
pas** (`brand = NULL`, affiché « toutes marques » selon le pôle). Les libellés `TOUTES MARQUES VL` et
`TOUTES MARQUES EQUIPMENT` du fichier source sont **convertis en `NULL` à l'import** — jamais stockés
comme des marques, sinon ils polluent les agrégats et les habilitations.

Conséquence sur l'autorisation : un manager habilité `peugeot` voit les lignes PEUGEOT **plus** les
lignes sans marque de son pôle.

### 3.4 Catalogues en attente

Les catalogues arrivent progressivement. Une famille porte donc un **statut** :

| Statut | Effet |
|--------|-------|
| `READY` | Lignes importées, saisie ouverte |
| `PENDING` | Famille visible dans la grille, **bandeau « catalogue en préparation »**, saisie impossible |
| `HIDDEN` | Absente de l'interface |

C'est ce qui permet d'ouvrir la campagne 2027 **sans attendre le dernier catalogue** : YAMAHA reste
`PENDING` et bascule en `READY` par simple import, sans migration ni redéploiement. Une famille qui
passe en `READY` après l'ouverture déclenche une notification aux filiales concernées — soumise à la
validation de l'équipe Academy comme tout envoi (§7).

### 3.5 Public cible — normaliser une colonne polluée

Le fichier source mélange dans une seule colonne deux notions distinctes, avec des séparateurs
libres (`Manager + Front office + back office`, `Manager, Back-office ; Front office`). À
l'import, cette colonne se scinde en **deux champs** :

| Champ | Type | Valeurs | Règle |
|-------|------|---------|-------|
| `tier` | énum, nullable | `JUNIOR` · `SENIOR` · `EXPERT` | Renseigné pour les formations techniques (203 lignes) |
| `populations` | ensemble, éventuellement vide | `MANAGER` · `FRONT_OFFICE` · `BACK_OFFICE` | Renseigné pour les formations process (43 lignes) |

Les 15 lignes du pôle `AUTRE` ont les deux champs vides — c'est licite et documenté, pas une erreur
d'import.

### 3.6 Clé naturelle — `(famille, marque, code)`, jamais `code` seul

**Point critique.** Le fichier de travail compte **261 lignes pour 231 codes distincts**. Le code
`TP02` existe à l'identique sur **dix marques** ; `SID01`, `SID02`, `SSHEV/EV01`, `SSHEV/EV02` sur
quatre chacun.

```
UNIQUE (campaign_id, family_id, brand_id, code)   -- brand_id NULLable (transverse)
```

`brand_id` étant nullable, l'unicité passe par un index partiel côté PostgreSQL :

```sql
CREATE UNIQUE INDEX ON catalog_line (campaign_id, family_id, brand_id, code)
  WHERE brand_id IS NOT NULL;
CREATE UNIQUE INDEX ON catalog_line (campaign_id, family_id, code)
  WHERE brand_id IS NULL;
```

Un import qui dédoublonne sur `code` seul **perd 30 lignes de catalogue**. C'est l'erreur la plus
probable et la plus silencieuse ; elle est couverte par un test unitaire dédié (§10).

### 3.7 Anomalies connues des sources — traitement à l'import

| Anomalie | Où | Traitement |
|----------|----|-----------|
| `SINOTRUCK` au lieu de `SINOTRUK` | fichier 2027, 1 ligne | Alias marque, corrigé + tracé au rapport |
| `OMODA & JAECCO` | `catalogues/training-catalog.json`, `frontend/src/`, 15 fichiers | **Orthographe de référence : `OMODA & JAECOO`** (graphie du fichier 2027, confirmée par le métier). `JAECCO` devient un alias d'import — story `16-25` pour la reprise du dépôt |
| `TOUTES_MARQUES` vs `TOUTES_MARQUES_VL` | `training-catalog.json`, Process Parts Motors | Les deux → `brand = NULL` |
| `STELLANTIS` monolithique | `training-catalog.json`, `catalogues/stellantis/` | Éclatement en 4 — story `16-24`, **hors import** |
| Code `-` | fichier 2027, 2 lignes YAMAHA | **Non bloquant** : la famille Yamaha reste `PENDING` (§3.4), ces lignes ne sont pas importées |
| `Back office` / `Back-office` / `Back-Office` | ~11 lignes | Normalisation casse + tiret |
| Séparateurs hétérogènes du public cible | ~9 lignes | Découpage sur `+`, `,`, `;`, `&` |
| Apostrophes typographiques | nombreuses | Conservées à l'affichage, normalisées pour la recherche |

---

## 4. Modèle de données

```
Campaign ─┬─< CatalogFamily ──< CatalogLine ──< NeedLine >── Submission >── OrgUnitRef
          │                          │                          │
          │                       Brand (nullable)              ├─< SubmissionEvent
          │                                                     └─< SubmissionCc
          └─< OutboundMessage ──< EmailSendLog
```

### `CatalogFamily`
Une famille de catalogue (§3.2). `campaign`, `key`, `label`, `pole`, `has_brands`, `status`
(`READY` \| `PENDING` \| `HIDDEN`), `sort_order`.
C'est cette entité qui rend la campagne ouvrable **avant** que tous les catalogues soient livrés :
une famille `PENDING` s'affiche avec un bandeau « catalogue en préparation » et n'accepte pas de
saisie.

### `Campaign`
Une campagne = un exercice. `year` (2027), `label`, `opens_at`, `closes_at`, `status`
(`DRAFT` → `OPEN` → `CLOSED` → `ARBITRATED` → `ARCHIVED`), `locale_default`.
La fermeture est une **date, pas un bouton** : après `closes_at`, l'API refuse toute écriture de
besoin, sauf réouverture explicite tracée.

### `CatalogLine`
`campaign`, `family`, `brand` (**nullable** = transverse), `code`, `title`, `tier`, `populations`,
`sort_order`. Immuable une fois la campagne ouverte — une correction crée une nouvelle version de
campagne, jamais une modification en place (le besoin déjà saisi resterait rattaché à l'ancienne
définition).

> `pole` et `category` ne sont **pas** des colonnes de la ligne : ils sont portés par la famille.
> Une ligne n'appartient qu'à une famille, et la famille détermine le pôle et la nature (technique
> ou process).

### `Submission`
La déclaration d'**une filiale** pour **une campagne**. `campaign`, `org_unit` (filiale), `country`,
`status` (`DRAFT` → `SUBMITTED` → `VALIDATED` → `REOPENED`), `submitted_by`, `submitted_at`,
`validated_by`, `validated_at`, `total_headcount` (dénormalisé, recalculé).
`UNIQUE (campaign, org_unit)`.

### `SubmissionCc`
Les destinataires en copie de la confirmation, **saisis par la personne qui remplit la fiche** au
moment de la soumission (hiérarchie, RH filiale, collègue). `submission`, `email`, `label`,
`source` (`MANUAL` \| `INHERITED` — hérité de la configuration de la filiale).

Ces adresses ne reçoivent **rien** tant que l'équipe Academy n'a pas validé (§7).

### `NeedLine`
Le cœur. Une ligne de catalogue × une soumission :

| Champ | Type | Contrainte |
|-------|------|-----------|
| `submission` | FK | — |
| `catalog_line` | FK | `UNIQUE (submission, catalog_line)` |
| `q1`…`q4` | entier | `>= 0`, défaut 0 |
| `place_q1`…`place_q4` | énum | `CFR` \| `FILIALE`, défaut `CFR` |
| `comment` | texte | facultatif |

Les lignes à effectif nul **ne sont pas stockées** : une `NeedLine` n'existe que si au moins un
trimestre est renseigné. Cela évite 261 lignes vides par filiale et rend l'export lisible.

### `SubmissionEvent`
Journal d'audit de la soumission : `submission`, `at`, `actor`, `kind` (`created`, `line_changed`,
`submitted`, `validated`, `reopened`, `reminder_sent`), `payload` JSONB.
**Le remplacement total est interdit** — leçon directe de l'audit Academix (principe 3). Toute
modification d'effectif est un événement, pas un écrasement.

### `OrgUnitRef`
Miroir local des filiales : `code`, `label`, `country`, `locale`, `org_path` (liste ordonnée, format
plateforme), `parent`. Alimenté par import en mode standalone, par synchronisation en mode intégré.

---

## 5. Rôles et autorisation

Aucun rôle nouveau : le module réutilise le vocabulaire de `PLATFORM_ROLES.md`.

| Rôle | Ce qu'il fait | Portée |
|------|---------------|--------|
| `team_manager`, `workshop_manager` | Saisit et **soumet** les besoins de son équipe, désigne les CC | Agence + marques assignées |
| `dps`, `dop` | Consolide et relit son département avant soumission | Département, agence ou filiale |
| `branch_director` | Relit sa filiale ; **destinataire en copie** de la confirmation | Filiale |
| `branch_admin`, `branch_hr` | **Saisie déléguée** pour le compte d'un manager | Filiale |
| `center_assistant` | **Relit et valide les fiches**, approuve les envois, relance, saisit à la place | Groupe |
| `center_director` | Idem + ouvre et clôt la campagne, arbitre | Groupe |
| `group_admin`, `group_director` | Vue consolidée | Groupe |
| `superadmin` | Tout | Groupe |

> **La validation est un acte de l'équipe Academy**, pas de la filiale (§6.2). C'est le seul rôle
> habilité à faire sortir un email vers une filiale.

### Ressources Cerbos

Trois nouvelles ressources, ajoutées à `cerbos/policies/resource_policies/` :

| Ressource | Actions | Règle principale |
|-----------|---------|------------------|
| `needs_campaign` | `read`, `create`, `open`, `close`, `arbitrate` | Écriture : `center_director`, `superadmin`. Lecture : tout compte authentifié. |
| `needs_submission` | `read`, `create`, `update`, `submit`, `validate`, `reopen` | `update` et `submit` via `team_within_scope` ; **`validate` et `reopen` réservés à `center_assistant`, `center_director`, `superadmin`** — jamais à un rôle de filiale |
| `needs_line` | `read`, `write` | Dérivé du parent + filtrage par famille et marques du principal |
| `needs_outbound` | `read`, `approve`, `reject`, `send` | **`center_assistant`, `center_director`, `superadmin` uniquement.** Test négatif obligatoire sur `branch_director` et `branch_admin` |

**Rappels de la skill `cerbos-policy`** — applicables tels quels :
`roles` + `derivedRoles` dans la même règle valent **OU**, pas ET : pour exiger « rôle **et**
périmètre », passer par le rôle dérivé seul. Chaque ressource a ses tests **positifs et négatifs**,
la CI échoue sinon.

### Filtrage des marques

Un `team_manager` ne voit dans la grille que les lignes dont la marque est dans ses marques
assignées, **plus** les lignes `is_cross_brand` de son pôle. Ce filtrage est appliqué par **query
plan Cerbos**, jamais côté front — la grille complète ne doit jamais transiter.

---

## 6. Parcours

### 6.1 Manager de filiale

1. **Connexion** SSO. Aucun mot de passe géré par le module.
2. **Page campagne** : exercice 2027, date de clôture, état de sa soumission, taux de complétion.
3. **Grille de saisie** — une ligne par formation de son périmètre, colonnes T1 T2 T3 T4 (effectif)
   et Lieu T1…T4. Filtres pôle / marque / catégorie / niveau, recherche plein texte sur code,
   intitulé et marque.
4. **Brouillon permanent** : chaque modification est enregistrée côté serveur (débounce 800 ms), pas
   seulement dans le navigateur. Un bandeau indique le dernier enregistrement.
   *Le stockage local reste un filet de secours hors ligne, pas la source de vérité — correctif
   direct du principe 4 d'Academix.*
5. **Récapitulatif avant envoi** : total collaborateurs, ventilation trimestrielle, répartition
   CFR / filiale, nombre de formations retenues.
6. **Destinataires en copie** : avant d'envoyer, l'auteur saisit les adresses à mettre en copie de la
   confirmation — sa hiérarchie, la RH filiale, un collègue. La configuration de la filiale peut en
   pré-remplir (`source = INHERITED`), l'auteur en ajoute ou en retire.
7. **Soumission** → statut `SUBMITTED`, grille verrouillée, écran de suivi indiquant
   « en cours de relecture par l'équipe Academy ».
   **Aucun email ne part vers la filiale à cette étape** (§7.0).

### 6.2 Équipe Academy — la relecture

C'est l'étape centrale du circuit.

1. **Notification interne** : résumé de la fiche + lien profond, groupé après 30 min d'inactivité.
2. **Ouverture de la fiche** dans la plateforme : grille en lecture, récapitulatif, écarts éventuels
   avec la campagne précédente, historique des modifications (`SubmissionEvent`).
3. **Décision** :
   - **Valider** → prépare `submission_confirmed` à destination de l'auteur, **ses CC en copie**,
     puis envoi depuis l'écran « À envoyer ».
   - **Réouvrir** → motif obligatoire, la grille se déverrouille pour la filiale, un message
     `submission_reopened` est préparé.
   - **Corriger avant validation** → l'équipe modifie la fiche elle-même ; la correction est tracée
     avec son auteur réel et signalée dans la confirmation.

> **Le directeur de filiale n'est pas le validateur.** Il figure parmi les destinataires en copie de
> la confirmation. La validation qui déclenche l'envoi appartient à l'équipe Academy — c'est elle
> qui porte la campagne et qui répond des chiffres consolidés.

### 6.3 Équipe Academy — le pilotage

Tableau de bord de campagne : filiales soumises / en cours de relecture / en saisie / silencieuses,
totaux par famille, marque, trimestre et lieu, export consolidé.
Écran **« À envoyer »** : messages en attente de relecture, prévisualisation, envoi unitaire ou par
lot, rejet motivé.
**Saisie déléguée** : ouvrir la grille au nom d'une filiale, avec traçabilité de l'acteur réel dans
`SubmissionEvent`.

> **Leçon Academix F11.** La saisie déléguée n'est pas un correctif de rattrapage ajouté en décembre :
> elle fait partie du périmètre dès R1. Sur 92 managers, une partie ne se connectera pas.

---

## 7. Emailing — circuit à validation

### 7.0 Le principe : rien ne sort sans relecture

**Aucun email ne part vers une filiale sans qu'un membre de l'équipe Academy l'ait validé dans la
plateforme.** C'est la règle structurante du module, et elle s'écarte volontairement du modèle
transactionnel classique.

```
① Manager remplit et soumet sa fiche
        │
        │  seul envoi automatique — et il est INTERNE
        ▼
② Équipe Academy reçoit un email : résumé de la fiche + lien vers la plateforme
        │
        ▼
③ L'équipe ouvre la fiche dans la plateforme, relit, corrige au besoin
        │
        │  action explicite « Valider »
        ▼
④ Confirmation envoyée à l'auteur de la fiche, SES CC en copie
```

Ce que ça change, concrètement :

| | Modèle transactionnel classique | Ici |
|---|---|---|
| À la soumission | Accusé de réception immédiat à l'auteur | **Rien** ne part vers la filiale |
| Destinataire du premier envoi | L'auteur | **L'équipe Academy** |
| Déclencheur de la confirmation | L'événement `submitted` | **La validation humaine** |
| Rôle de l'email interne | — | Porte un **résumé** et un **lien**, pas la donnée complète |

**Pourquoi.** Une fiche mal remplie confirmée automatiquement est une fiche qu'il faut ensuite
démentir auprès de la filiale et de sa hiérarchie en copie. La relecture avant confirmation coûte
quelques minutes à l'équipe et évite ce démenti. C'est aussi ce qui donne à l'équipe une prise réelle
sur la campagne plutôt qu'un flux qu'elle subit.

### 7.0 bis · File de sortie

Toute intention d'envoi vers une adresse **hors équipe Academy** crée un `OutboundMessage` :

| Champ | Contenu |
|-------|---------|
| `kind` | Type de message (§7.7) |
| `submission` / `campaign` | Objet rattaché |
| `to`, `cc` | Destinataires résolus au moment de la préparation |
| `template`, `template_version`, `locale` | Rendu figé |
| `status` | `PENDING_REVIEW` → `APPROVED` → `SENT` \| `FAILED` · ou `REJECTED` |
| `reviewed_by`, `reviewed_at`, `reject_reason` | Traçabilité de la décision |

Un écran **« À envoyer »** liste les messages en attente, avec prévisualisation du rendu réel et
envoi unitaire ou par lot. Un message rejeté est archivé avec son motif, jamais supprimé.

Chaque type de message porte un mode — `REVIEW` (défaut) ou `AUTO`. **Le mode `AUTO` n'est ouvert
qu'aux destinataires internes à l'équipe Academy.** Un type visant une filiale ne peut pas être
basculé en `AUTO` : la contrainte est vérifiée au démarrage, pas laissée à la configuration.

### 7.1 Architecture

**Envoi asynchrone**, jamais dans la requête HTTP. `needs-worker` (Django-Q2, broker Postgres)
consomme la file des `OutboundMessage` **approuvés**. Fournisseur abstrait derrière une interface
`EmailBackend` — SMTP interne en R0, bascule SES / Azure Communication Services sans toucher au
métier.

### 7.2 Templates

Stockés en base (`EmailTemplate`), **versionnés** : `key`, `version`, `locale`, `subject`,
`body_text`, `body_html`, `placeholders` (liste déclarée et vérifiée au rendu). Un envoi référence
la **version** utilisée — un template modifié après coup ne réécrit pas l'historique.
Éditeur avec prévisualisation sur données réelles avant envoi.

### 7.3 Journal d'envoi

`EmailSendLog` : template + version, destinataires, campagne, filiale, statut
(`QUEUED` → `SENT` → `FAILED` → `BOUNCED`), erreur, horodatages, nombre de tentatives.
**Renvoi manuel** depuis le journal. Réessai automatique à intervalle croissant (1 min, 5 min,
30 min, 2 h) puis abandon avec alerte.

### 7.4 Relances — préparées par la machine, envoyées par l'équipe

La machine à états d'Academix (F18) est conservée, mais elle **prépare** les relances au lieu de les
expédier : chaque transition crée un `OutboundMessage` en `PENDING_REVIEW`.

```
NONE ──▶ J-21 ──▶ J-10 ──▶ J-3 ──▶ J+1 (escalade directeur filiale) ──▶ CLOSED
  │        │        │        │
  └────────┴────────┴────────┴──▶ SUBMITTED : sort de la machine, plus aucune relance préparée
```

L'état est stocké sur la soumission (`reminder_state`, `last_reminder_at`), pas recalculé à la
volée : une relance n'est préparée qu'une fois, même si le worker rejoue. L'escalade `J+1` change de
destinataire — le manager silencieux sort de la boucle, son directeur prend le relais.

L'équipe reçoit à chaque échéance **un seul email interne** listant les filiales à relancer, avec le
lien vers l'écran « À envoyer » où elle approuve le lot en une action. Elle peut retirer une filiale
du lot (contact en cours par un autre canal) — le retrait est tracé.

### 7.5 Temporisation par inactivité

Le résumé interne envoyé à l'équipe (étape ② du circuit) est **groupé après 30 minutes
d'inactivité** sur la soumission : une filiale qui ajuste sa fiche trois fois dans l'heure produit
un seul email à l'équipe, pas trois. Academix utilisait 3 minutes ; l'écart est assumé, la saisie est
ici plus longue et le destinataire est interne.

### 7.6 Langue et civilité

**La langue est portée par la personne**, pas déduite de sa filiale. C'est la correction explicite de
ce qui a coûté six PR correctives à Academix (F19) : un francophone en filiale ghanéenne existe.

- `User.locale` (`fr` \| `en`), initialisée depuis la filiale, **modifiable par l'intéressé**
- `User.civility` (`M` \| `MME` \| `NEUTRE`) — `NEUTRE` est la valeur par défaut et produit une
  formule sans genre, jamais une supposition
- Tout template existe dans les deux locales ; l'absence d'une traduction est une **erreur de CI**,
  pas un repli silencieux

### 7.7 Catalogue des messages

| Clé | Déclencheur | Destinataire(s) | Mode |
|-----|-------------|-----------------|------|
| `internal_submission_summary` | Soumission (+ 30 min d'inactivité) | **Équipe Academy** — résumé + lien vers la fiche | `AUTO` (interne) |
| `internal_reminder_batch` | Échéance J-21 / J-10 / J-3 / J+1 | **Équipe Academy** — filiales à relancer + lien | `AUTO` (interne) |
| `internal_catalog_ready` | Famille `PENDING` → `READY` | **Équipe Academy** — filiales à informer | `AUTO` (interne) |
| `submission_confirmed` | **Validation par l'équipe** | Auteur de la fiche, **ses `SubmissionCc` en copie** | `REVIEW` |
| `submission_reopened` | Réouverture par l'équipe | Auteur, ses CC en copie — **motif obligatoire** | `REVIEW` |
| `campaign_opened` | Ouverture de campagne | Saisisseurs des filiales concernées | `REVIEW` |
| `reminder_j21` / `j10` / `j3` | Machine §7.4 | Saisisseur | `REVIEW` |
| `escalation_j1` | Machine §7.4 | Directeur filiale, copie équipe Academy | `REVIEW` |
| `catalog_ready_notice` | Famille passée `READY` | Saisisseurs des marques concernées | `REVIEW` |
| `delegated_entry_notice` | Saisie déléguée | Manager concerné (information) | `REVIEW` |
| `campaign_digest` | Hebdomadaire, campagne ouverte | Équipe Academy, MOA | `AUTO` (interne), **opt-out** |

**Lecture de la colonne Mode.** `AUTO` = part sans relecture, et **uniquement** vers l'équipe
Academy. `REVIEW` = passe par l'écran « À envoyer ». Aucune ligne visant une filiale n'est en `AUTO`,
et la contrainte est vérifiée au démarrage (§7.0 bis).

**Le résumé interne ne contient pas la fiche.** Il porte les totaux (collaborateurs, ventilation
trimestrielle, répartition CFR / filiale, nombre de formations), le nom de la filiale, l'auteur — et
un **lien profond** vers la fiche dans la plateforme. Le détail se lit dans l'outil, pas dans la
boîte mail : c'est ce qui garantit que la relecture a bien lieu là où la correction est possible.

Le digest hebdomadaire est le seul message désabonnable ; tous les autres portent une obligation de
service.

---

## 8. Import et export

### 8.1 Import du référentiel

Applique le **patron d'import tabulaire** (`docs/PATRON_IMPORT_TABULAIRE.md`) : synonymes d'en-têtes,
validation ligne à ligne, rapport d'erreurs téléchargeable, modèle vierge fourni, journal d'import
persistant, transaction tout-ou-rien.

Spécificités de cet import :
- clé `(famille, marque, code)` — **jamais `code` seul** (§3.6)
- alias de marques appliqués avant rapprochement (`SINOTRUCK` → `SINOTRUK`)
- éclatement de la colonne public cible en `tier` + `populations` (§3.3)
- rejet bloquant des codes `-` ou vides
- refus d'import si la campagne est déjà `OPEN`

### 8.2 Import des besoins (saisie déléguée)

Même patron. Une filiale par fichier, rapprochement des lignes sur `(famille, marque, code)`, rapport
listant les lignes non rapprochées. **Ne crée jamais de ligne de catalogue** : une formation absente
du référentiel est une erreur, pas un ajout implicite.

### 8.3 Exports

| Export | Format | Contenu |
|--------|--------|---------|
| Ma soumission | XLSX, CSV | Lignes saisies + récapitulatif |
| Consolidé campagne | XLSX | Toutes filiales × formations × trimestres × lieux |
| Synthèse par marque | XLSX | Effectifs par marque × trimestre × lieu |
| Plan d'ouverture | JSON | Contrat de sortie vers le nœud E (§11) |

---

## 9. API

Préfixe `/api/v1/needs/`. Conventions plateforme (`architecture.md` §5.1).

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/campaigns` · `/campaigns/{id}` | Campagnes visibles |
| `POST` | `/campaigns/{id}/open` · `/close` | Pilotage campagne |
| `GET` | `/campaigns/{id}/families` | Familles + statut `READY` / `PENDING` (§3.4) |
| `GET` | `/campaigns/{id}/catalog` | Référentiel **filtré par query plan Cerbos** |
| `GET` | `/submissions` · `/submissions/{id}` | Liste filtrée par périmètre |
| `POST` | `/submissions` | Ouvre le brouillon d'une filiale |
| `PATCH` | `/submissions/{id}/lines` | Écriture incrémentale (lot de lignes) |
| `POST` | `/submissions/{id}/submit` · `/validate` · `/reopen` | Transitions d'état |
| `GET` | `/campaigns/{id}/summary` | Agrégats consolidés |
| `POST` | `/imports/catalog` · `/imports/needs` | Imports (§8) |
| `GET` | `/imports/{id}/report` | Rapport d'erreurs |
| `GET` | `/exports/...` | Exports (§8.3) |
| `GET` | `/submissions/{id}/cc` · `PUT` | Destinataires en copie de la confirmation |
| `GET` | `/outbound` | File « À envoyer » — messages en `PENDING_REVIEW` |
| `GET` | `/outbound/{id}/preview` | Rendu réel avant approbation |
| `POST` | `/outbound/{id}/approve` · `/reject` · `/send` | Décision et envoi (unitaire) |
| `POST` | `/outbound/batch/send` | Envoi par lot après approbation |
| `GET` | `/emails/logs` · `POST /emails/logs/{id}/resend` | Journal d'envoi |
| `GET` | `/healthz` | Sonde non authentifiée |

Toute vue de liste passe par le **query plan Cerbos** converti en `Q` Django
(`core.authz.filters.plan_to_q`), jamais par un filtrage applicatif après coup.

---

## 10. Sécurité — les onze interdits

Repris de l'audit Academix (`docs/AUDIT_ACADEMIX.md` §6). Chacun est un test ou un contrôle CI, pas
une consigne.

| # | Interdit | Contrôle |
|---|----------|----------|
| 1 | Mot de passe stocké, même chiffré réversible | Aucune colonne mot de passe — Keycloak est seul dépositaire |
| 2 | Identifiants dans le dépôt | Gitleaks bloquant en CI (déjà en place) |
| 3 | Secret par défaut en dur | Démarrage **refusé** si `SECRET_KEY` ou secret OIDC absent de l'environnement |
| 4 | `.env` versionné | `.gitignore` + contrôle CI sur `git ls-files` |
| 5 | CORS ouvert | Origines explicites, jamais `*` ; test d'intégration dédié |
| 6 | Rôle lu côté client | Le front n'utilise le JWT que pour l'affichage ; toute décision vient de l'API |
| 7 | Deux chemins d'authentification divergents | Un seul middleware, un seul code d'erreur (401), test dédié |
| 8 | Endpoint sans PEP | Test qui énumère les routes et échoue sur toute vue sans `CerbosPermission` |
| 9 | Dépendance vulnérable | `pip-audit` + `npm audit` bloquants en CI |
| 10 | Migration + seed au démarrage du conteneur de production | Entrypoint distinct ; le seed est une commande explicite |
| 11 | **Envoi automatique vers une adresse hors équipe Academy** | Un type de message en mode `AUTO` avec un destinataire externe **fait échouer le démarrage** ; test dédié sur le catalogue §7.7 |

### Tests — séquence obligatoire

Conforme à `planning.md` §6 : **TU → TI → contrat → E2E**.

- **TU** — normalisation du référentiel (dont le test « `TP02` sur 10 marques donne 10 lignes »),
  machine à états de relance, rendu de template, calcul des agrégats
- **TI** — endpoints avec base réelle, transitions de soumission, imports bout en bout
- **Policy** — `cerbos compile --tests` : positifs **et négatifs** sur les 3 ressources
- **E2E** — un parcours par rôle : manager saisit et soumet, directeur valide, assistante relance,
  admin exporte

---

## 11. Raccordement à la plateforme

Le module n'est pas un cul-de-sac. Trois points de jonction, spécifiés dès maintenant, implémentés
plus tard :

| Jonction | Sens | Contrat |
|----------|------|---------|
| **Référentiel** | Plateforme → module | Job de synchronisation `lms.Course` → `CatalogLine`, clé `(famille, marque, code)` |
| **Organisation** | Plateforme → module | Synchronisation `identity.OrgUnit` → `OrgUnitRef`, `org_path` identique |
| **Plan d'ouverture** | Module → plateforme | Événement `needs_consolidated` → nœud **E** : alimente l'ouverture des sessions |

L'événement `needs_consolidated` s'ajoute au tableau `planning.md` §3. Sa mise en œuvre est
**hors R0** — le contrat est figé maintenant pour que le nœud E puisse être écrit en le supposant.

---

## 12. Jalons

**Aujourd'hui : mardi 25 août 2026. R0 attendu vendredi 28 août — trois jours ouvrés.**

**Priorité posée par la MOA : le parcours complet d'abord, le contenu des catalogues ensuite.**
Les catalogues arrivent progressivement ; le mécanisme `PENDING` / `READY` (§3.4) permet de livrer
et de faire valider **tout l'enchaînement** avec un référentiel partiel, puis de brancher chaque
famille par simple import.

### R0 · vendredi 28 août — *le circuit complet, référentiel partiel*

**Socle**
- [ ] `docker-compose.needs.yml` complet, démarrage sur machine vierge
- [ ] Realm Keycloak `cfao-needs` en config-as-code
- [ ] Policies Cerbos `needs_campaign`, `needs_submission`, `needs_line`, `needs_outbound` + tests
      positifs **et négatifs**
- [ ] Modèle de données + migrations, familles et statuts de catalogue

**Le parcours de bout en bout — c'est la cible de R0**
- [ ] Page **campagne** : familles, statuts, dates, état de ma soumission
- [ ] Page **grille de saisie** : effectifs T1–T4, lieux CFR / Filiale, brouillon serveur, filtres
      par famille / marque / niveau, recherche ; familles `PENDING` affichées et non saisissables
- [ ] Page **récapitulatif + destinataires en copie**, puis soumission
- [ ] Page **suivi** côté filiale (« en cours de relecture »)
- [ ] Page **équipe Academy** : liste des fiches, ouverture d'une fiche, validation / réouverture
      motivée
- [ ] Page **« À envoyer »** : file, prévisualisation, approbation, envoi
- [ ] Email interne de résumé + lien profond ; confirmation à l'auteur avec ses CC

**Données**
- [ ] Import du référentiel — clé `(famille, marque, code)`, anomalies §3.7 traitées
- [ ] Familles livrées en `READY`, les autres en `PENDING`
- [ ] CI verte + image poussée au registre

> **Ce qui saute si le temps manque** — dans cet ordre, et en le disant : export XLSX, puis les
> filtres avancés, puis l'éditeur de templates (templates en fichiers pour R0).
> **Ne sautent jamais** : le PEP Cerbos, la clé `(famille, marque, code)`, le refus de démarrage sans
> secret, et **le fait qu'aucun email ne parte vers une filiale sans validation**.

### R1 · +2 semaines — *emailing complet et délégation*

Templates en base, versionnés et localisés, avec éditeur et prévisualisation · journal d'envoi et
renvoi · machine de relance préparant les lots · temporisation par inactivité · saisie déléguée ·
import des besoins · digest hebdomadaire interne.

### R2 · +2 semaines — *consolidation*

Tableau de bord de campagne · exports consolidés et synthèse par famille et par marque · arbitrage
CFR / filiale · contrat `needs_consolidated` figé et testé.

### Hors jalons — dépendances métier

| Attendu | De qui | Bloque |
|---------|--------|--------|
| Catalogues manquants (dont YAMAHA) | Métier | Rien en R0 — familles `PENDING` |
| Éclatement Stellantis dans `training-catalog.json` et `catalogues/` | Équipe plateforme | Le catalogue Motors complet — story `16-24` |
| ~~Orthographe de référence Omoda~~ | ~~Métier~~ | **Tranché : `OMODA & JAECOO`** — reprise du dépôt en story `16-25` |
| Liste des destinataires en copie par filiale | Équipe Academy | Pré-remplissage seulement ; l'auteur peut saisir à la main |

---

## 13. Risques

| Risque | Effet | Parade |
|--------|-------|--------|
| **R0 en 3 jours** | Périmètre non tenu | Ordre de sacrifice écrit (§12), aucune coupe dans la sécurité ni dans le circuit de validation |
| **Catalogues livrés au fil de l'eau** | Campagne ouverte sur un référentiel incomplet | Statut `PENDING` / `READY` par famille (§3.4) — la campagne s'ouvre sans attendre, chaque famille se branche par import |
| **Goulot de relecture** — toutes les fiches passent par l'équipe Academy | Confirmations en retard, filiales sans nouvelles | Écran « À envoyer » avec approbation **par lot**, indicateur d'ancienneté des fiches en attente, alerte au-delà de 48 h |
| **Capacité partagée** avec le chemin critique | Décale le nœud D | Assumé et chiffré : `planning.md` §2 nœud **N**, 3,5 sem.-personne |
| **Faible adoption** des managers | Campagne incomplète | Saisie déléguée dès R1 + escalade J+1 au directeur |
| **Divergence** avec la plateforme | Réintégration coûteuse | Interfaces `ReferentialSource` / `IdentityProvider` dès R0 ; jamais d'appel direct |

---

## 14. Références

- Audit de l'existant : `docs/AUDIT_ACADEMIX.md` — F07, F10, F11, F17, F18, F19, F22
- Patron d'import : `docs/PATRON_IMPORT_TABULAIRE.md`
- Stories : `backlog.md` §16
- Planification : `planning.md` §2 nœud **N**, §3 événement `needs_consolidated`
- Matrice d'accès : `PLATFORM_APPS.md` §16
- Patron module sécurisé : skill `module-securise`
- Règles de policy : skill `cerbos-policy`
