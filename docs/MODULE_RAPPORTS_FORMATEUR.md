# Module formateur — rapports post-formation

Story **`04-5`** — *En tant que formateur, je veux rédiger un rapport post-formation.*
App **04 · Espace formateur** ([PLATFORM_APPS.md](../PLATFORM_APPS.md)).

Le module guide le formateur de la saisie des notes jusqu'au rapport PowerPoint final, identique
aux comptes rendus produits jusqu'ici à la main. Il couvre deux sortes de sessions :

| Sorte | Évaluation | Pages propres |
|---|---|---|
| **Formation** | test d'entrée, test de sortie, pratique → progression et acquisition | résultats, satisfaction, fiche par stagiaire (diapositive 27) |
| **Certification pratique** | modules notés sur 100, e-learning → CERTIFIÉ / NON CERTIFIÉ | fiche par candidat (diapositive 26) |

Tout ce dont la production du rapport a besoin est **dans le dépôt** : modèle PowerPoint,
modèle Excel d'évaluation, moteur de rédaction, catalogue des certifications. Aucun dossier
externe n'est lu.

---

## 1. Parcours

Route d'entrée : `/portail/compte-rendu/nouveau` (profil formateur).

| Étape | Composant | Contenu |
|---|---|---|
| 1. La formation | `PhaseSession.jsx` | session du planning ou saisie libre, participants présents, type formation / certification |
| 2. Les notes | `PhaseResultats.jsx` | notes (tableau ou `SaisieCertification.jsx`), avis des stagiaires, import / export Excel |
| 3. Les pages | `PhaseStructure.jsx` | parties retenues du rapport |
| 4. Compléter | `PhaseVerification.jsx` | chaque page en **Remplir** (formulaire) ou **Voir la page** (rendu réel), puis production du rapport |

Pages annexes : `TrainerReportsEnCours.jsx` (reprise des brouillons), `TrainerReportsTermines.jsx`
(`/portail/compte-rendu/mes-rapports`, rapports terminés), carte d'accueil dans `TrainerHome.jsx`.

**Statut d'une page** (sommaire de l'étape 4) : ✓ quand tous ses champs obligatoires sont remplis,
● sinon, avec la liste de ce qui manque. Les pages sans saisie sont ✓ d'office. Un rapport dont
toutes les pages sont ✓ est **terminé** : il quitte « en cours » et rejoint « Mes comptes rendus »
(`pagesARemplir()` dans `PhaseVerification.jsx`, `estTermine()` dans `brouillonsCompteRendu.js`).

---

## 2. Architecture

```
Navigateur (SPA React)                     services/  (Python)
┌──────────────────────────┐   /apercu/*    ┌─────────────────────────────────┐
│ frontend/src/…compte-rendu│ ─────────────▶ │ apercu/api.py (Flask)            │
│  - saisie, brouillon      │  /cr-donnees/* │  - service.py : drapeaux → PPTX  │
│  - valeursDrapeaux()      │ ─────────────▶ │  - composer/alleger : PPTX réduit│
│  - export/import Excel    │                │  - LibreOffice : PPTX → PNG/PDF  │
│    (exceljs, dans le      │                │  - stockage.py : brouillons      │
│     navigateur)           │                │  - photos.py : photos, légendes  │
└──────────────────────────┘                │ redaction/ : moteur de texte     │
                                            │ apercu/modeles/MODELE-REFERENCES │
                                            └─────────────────────────────────┘
```

- **Dev** : le serveur Vite relaie `/apercu` et `/cr-donnees` vers `127.0.0.1:5175`
  (`frontend/vite.config.js`).
- **Docker Compose** : service `rapports` (`services/Dockerfile`), joignable seulement par la
  passerelle nginx, qui route les mêmes chemins (`gateway/nginx.conf`).

Ce service Flask est un **écart assumé et transitoire** par rapport à l'architecture cible
(Django / Node, Keycloak, Cerbos, PostgreSQL) : voir
[ADR 0001](./adr/0001-service-rapports-formateur.md) et les stories de mise en conformité (§ 9).

### Le principe : un modèle à drapeaux

Le rapport n'est pas dessiné par le code : il est **rempli**. `MODELE-REFERENCES.pptx` (anonymisé)
porte des drapeaux entre accolades (`{nom_complet}`, `{code_module_1}`, `{pourcentage}`…).

1. Le navigateur calcule les valeurs d'une page : `valeursDrapeaux()` (`utils/diapositives.js`).
2. Le service substitue les drapeaux dans le XML de la diapositive (`substituer()`), répète les
   lignes de tableau (`@lignes`), pose les photos (`@photos`), recolore les cases (`@couleurs`).
3. `composer.py` ne garde que les diapositives utiles (conversion en ~1 s au lieu de ~20 s).
4. LibreOffice convertit en PNG (aperçu, mis en cache sous l'empreinte des valeurs) ou produit
   le rapport complet (`/apercu/rapport`, PPTX ou PDF).

Règles à connaître avant de toucher au modèle ou aux drapeaux :

- **Un drapeau sans valeur reste visible** : une page incomplète doit se voir. Pour un champ vide
  *à dessein*, la valeur `VIDE` (`∅`, définie des deux côtés) efface le mot du modèle.
- **Clés spéciales** : `@lignes` (lignes répétées, chacune peut porter ses `@couleurs`),
  `@etendre` (le tableau descend dans la place libre avant de resserrer), `@retirer`,
  `@couleurs` (`ok` vert, `ko` rouge, `alerte` : case blanche passée au rouge), `@photos`,
  `@marquage` (numérotation des objectifs).
- **Hauteur des lignes répétées** : le service estime les retours à la ligne de chaque case
  (`hauteur_utile()`) et resserre police et marges pour que le tableau tienne dans la page.

### Diapositives du modèle

| Page | Diapositive |
|---|---|
| Couverture | 1 |
| Participants | 3, 4 |
| Objectifs | 5 puis 6 (romain), 7 (puces), 8 (mixte) ou 9 (avec photos) |
| Déroulé | 10, puis 11 / 13 en alternance par jour |
| Résultats, satisfaction | 16 à 19 |
| Bilan | 20 |
| Fiches | 25, puis 27 par stagiaire (formation) ou **26** par candidat (certification) |
| Clôture | 28 |

Sources : `DIAPO_PAR_PAGE` (`utils/diapositives.js`) et `DIAPOS` (`services/apercu/modele.py`).

**Fiche de certification (26)** — conforme aux rapports G3 de référence : tableau « Filiale »,
une ligne `G38001: intitulé / 100` par module (note rouge sous 70), `Total/ N`, `Pourcentage(%)`
et case Validé / Échoué ; bloc e-learning ; appréciation ; bandeau
*Résultat pratique + E-learning = Résultat final* en vert / rouge.

---

## 3. Données

### Brouillon

Un rapport en cours est un **brouillon** JSON, enregistré au fil de la saisie
(`utils/brouillonsCompteRendu.js` → `PUT /cr-donnees/brouillons/<id>`), relu sur tout poste.
**La version la plus récente l'emporte** (`modifieLe`) : deux onglets ouverts sur le même rapport
s'écrasent l'un l'autre.

Champs principaux : `type` (`formation` | `certification`), `codeFormation`, `intitule`, `debut`,
`fin`, `lieu`, `pays`, `participants[]` (notes, `notesModules`, `elearning`), `modules[]`
(certification), `satisfaction`, `textes` (clé `page.champ`), `photos` (par rubrique),
`dispositions`, `modesLegende`, `legendes`, `marquageObjectifs`, `termineLe`.

Stockage : SQLite dans `services/apercu/donnees/` (ignoré par Git ; volume `rapports-donnees`
en conteneur). Photos : `services/apercu/donnees/photos/`.

### Planning de démonstration et données personnelles

Les sessions proposées viennent de `frontend/src/data/mock_sessions_formateur.js`, en attendant
l'API `planning` de `cfao-operations`. **Les noms qui y figurent sont fictifs.**

Un poste qui anime de vraies sessions garde les vrais noms dans
`frontend/src/data/noms.local.js`, **ignoré par Git** (`*.local.js`) :

```js
export const NOMS = {
  h01: { prenom: 'Prénom', nom: 'NOM' },
}
```

Aucune donnée personnelle réelle ne doit entrer dans le dépôt (code, tests, messages de commit).

### Excel

Tout se passe dans le navigateur (`exceljs`, `jszip` pour les classeurs non standard) :

| Fichier | Export | Import |
|---|---|---|
| Résultats de certification | `classeurCertification.js` | `lireCertification()` |
| Évaluation des stagiaires (avis) | `exportEvaluation.js`, modèle `public/modeles/evaluation.xlsx` | `importEvaluation.js` |

Menu « Enregistrer en Excel » / « Reprendre d'un fichier Excel » (`MenuExcel.jsx`), avec modèles vides.

### Rédaction

`services/redaction/` propose appréciations, bilans et constats à partir des notes
(`POST /apercu/redaction`). Il n'invente rien : sans donnée, la phrase correspondante disparaît.
Le texte proposé reste à relire par le formateur.

---

## 4. API du service

| Route | Effet |
|---|---|
| `GET /apercu/sante` | le service, le modèle et LibreOffice sont-ils prêts |
| `POST /apercu/page` | PNG d'une diapositive (`{diapo, valeurs}`) |
| `POST /apercu/rapport` | rapport complet, page par page (`{pages, format}`) |
| `POST /apercu/rapports`, `GET /apercu/rapports/<id>[/fichier]` | même rapport, préparé en tâche de fond puis téléchargé |
| `POST /apercu/document` | rapport complet à partir des parties |
| `POST /apercu/photo` | dépôt d'une photo, renvoie son identifiant |
| `POST /apercu/redaction` | texte proposé par le moteur |
| `POST /cr-donnees/connexion` | `{identifiant, motDePasse, seSouvenir}` → profil + cookie `cfao_session` (HttpOnly) |
| `GET /cr-donnees/session`, `POST /cr-donnees/deconnexion` | profil connecté (401 sinon), fermeture de la session |
| `GET/PUT/DELETE /cr-donnees/brouillons[/<id>]` | brouillons du compte connecté |
| `GET /cr-donnees/photos/<id>.jpg` | photo enregistrée |

Hors `sante` et les trois routes de connexion, tout répond 401 sans session.

### Comptes des formateurs

Chaque formateur se connecte par le formulaire de `/login` ; les profils de démonstration de la
liste ne comptent aucun formateur. Les comptes (empreinte du mot de passe, profil avec le vrai
nom) sont dans `services/apercu/donnees/comptes.sqlite`, hors dépôt ; la base ne garde que
l'empreinte des jetons de session. « Se souvenir de moi » : 30 jours, sinon la session s'arrête
avec le navigateur (12 h au plus). Cinq échecs bloquent l'identifiant une minute.

```bash
python services/apercu/comptes.py creer <identifiant> <profil.json>   # affiche le mot de passe
python services/apercu/comptes.py mot-de-passe <identifiant>          # nouveau mot de passe, sessions fermées
python services/apercu/comptes.py liste
```

L'`id` du profil range les brouillons : le garder quand on recrée un compte. Le planning affiché
ne retient que les sessions dont le formateur est le compte connecté.

---

## 5. Démarrer en local

Prérequis : Node 20, Python 3.12, **LibreOffice** (Impress).

```bash
# Service (port 5175, boucle locale)
pip install -r services/requirements.txt
python services/apercu/api.py

# Interface (port 5174)
cd frontend && npm ci && npm run dev
# puis /portail/compte-rendu/nouveau avec un profil formateur
```

Variables : `CR_MODELE` (autre modèle), `CR_CACHE` (cache des images), `CR_SOFFICE` (chemin de
LibreOffice, par défaut celui de Windows), `CR_HOTE` / `CR_PORT` (écoute).

En conteneur : `docker compose up rapports gateway` — l'image embarque LibreOffice et des polices
métriquement compatibles (Liberation, Carlito). Le rendu Linux peut différer de quelques pixels
du rendu Windows.

---

## 6. Tests

```bash
cd frontend && npm test              # Vitest : calculs, drapeaux, légendes
cd services && pip install -r requirements-dev.txt && pytest -q tests
```

| Fichier | Couvre |
|---|---|
| `frontend/src/utils/certification.test.js` | pourcentage, seuil 70 %, résultat final, e-learning |
| `frontend/src/utils/diapositives.test.js` | drapeaux de la fiche de certification, code couleur |
| `frontend/src/data/dispositions_photos.test.js` | dispositions, modes de légende, anciens brouillons |
| `services/tests/test_service.py` | substitution, lignes répétées, couleurs, modèle versionné, rendu LibreOffice |
| `services/tests/test_brouillons.py` | contrat `/cr-donnees`, cloisonnement par utilisateur |

Le rendu LibreOffice est sauté en CI (LibreOffice absent du runner) ; il s'exécute en local.
**Les tests n'écrivent jamais dans `services/apercu/donnees/`** : base temporaire par test.

---

## 7. Modifier le modèle PowerPoint

1. Ouvrir `services/apercu/modeles/MODELE-REFERENCES.pptx` dans PowerPoint.
2. Garder chaque drapeau **seul dans son run** (le retaper d'un bloc si PowerPoint le coupe).
3. Ne pas renuméroter les diapositives sans mettre à jour `DIAPO_PAR_PAGE` et `modele.py`.
4. Aucune donnée réelle (nom, photo) dans le modèle : il est anonymisé.
5. `pytest -q services/tests` vérifie la présence des drapeaux de la fiche de certification.

---

## 8. Pièges connus

- **Un onglet ouvert écrase une correction faite ailleurs** (la dernière écriture gagne) : un seul
  onglet par rapport.
- **LibreOffice et profil neuf** : la première conversion peut ne rien produire ; `convertir()`
  retente une fois.
- **Deux instances LibreOffice sur un même profil** se bloquent : conversions sérialisées
  (`classeurs.LIBREOFFICE`), un profil par service.
- Pièges d'interface (hauteurs flex, `section` imbriquées…) : voir
  [CONTEXTE-COMPTE-RENDU.md](../CONTEXTE-COMPTE-RENDU.md) § 4.

---

## 9. Écarts avec l'architecture cible

| Écart | Cible | Story |
|---|---|---|
| Comptes et sessions propres au service (SQLite, cookie) | JWT Keycloak validé, policy Cerbos `compte_rendu` avec tests négatifs | `04-5.1` |
| Brouillons en SQLite dans le service | module `cfao-operations` (PostgreSQL), le service ne fait plus que le rendu | `04-5.2` |
| Textes d'interface en français dans les composants | `frontend/src/i18n/` (FR, EN, PT) | `04-5.3` |
| Pas de test de bout en bout | parcours formateur E2E sur la stack Compose | `04-5.4` |
| Planning de démonstration dans le frontend | API `planning` de `cfao-operations` | `04-5.5` |

Tant que `04-5.1` n'est pas livrée, le service ne doit être exposé que derrière la passerelle,
sur un réseau interne.
