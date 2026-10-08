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
Navigateur (SPA React)                     cfao-comptes-rendus/api (Django)
┌──────────────────────────┐   /apercu/*    ┌─────────────────────────────────┐
│ frontend/src/…compte-rendu│ ─────────────▶ │ comptes_rendus/views.py (DRF)    │
│  - saisie, brouillon      │  /cr-donnees/* │  - PEP Cerbos sur chaque route   │
│  - valeursDrapeaux()      │ ─────────────▶ │  - stockage.py : brouillons      │
│  - export/import Excel    │                │ core/auth : OIDC ou profils dev  │
│    (exceljs, dans le      │                │ rendu/service.py : drapeaux→PPTX │
│     navigateur)           │                │  - LibreOffice : PPTX → PNG/PDF  │
└──────────────────────────┘                │  - photos.py : photos, légendes  │
                                            │ redaction/ : moteur de texte     │
                                            │ rendu/modeles/MODELE-REFERENCES  │
                                            └───────────────┬─────────────────┘
                                                            │ CheckResources
                                            cfao-comptes-rendus/cerbos (default-deny)
```

- **Dev** : le serveur Vite relaie `/apercu` et `/cr-donnees` vers `127.0.0.1:5175`
  (`frontend/vite.config.js`).
- **Docker Compose** : service `rapports` (`cfao-comptes-rendus/Dockerfile`) et son Cerbos
  `rapports-cerbos`, joignables seulement par la passerelle nginx, qui route les mêmes chemins
  (`gateway/nginx.conf`). Le dossier `cfao-comptes-rendus/` se déploie aussi seul (son propre
  `docker-compose.yml`, `Makefile`, `.env.example`).

L'ancien service Flask (écart transitoire de l'[ADR 0001](./adr/0001-service-rapports-formateur.md))
est remplacé par ce service détachable (story 04-5-1), sur le modèle du kit `template-service` :
base propre, identité `standalone` / `integrated`, Cerbos par défaut refusé, OIDC.

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
  *à dessein*, la valeur `VIDE` (`∅`, définie des deux côtés) efface le mot du modèle. Un mot nu
  vide (sous-titre de couverture) retire aussi sa ligne, et le bloc de la couverture est centré.
- **Clés spéciales** : `@lignes` (lignes répétées, chacune peut porter ses `@couleurs`),
  `@etendre` (le tableau descend dans la place libre avant de resserrer), `@retirer`,
  `@couleurs` (`ok` vert, `ko` rouge, `alerte` : case blanche passée au rouge), `@photos`,
  `@marquage` (numérotation des objectifs).
- **Hauteur des lignes répétées** : le service estime les retours à la ligne de chaque case
  (`hauteur_utile()`) et resserre police et marges pour que le tableau tienne dans la page.
- **Mise en page finale** (`mise_en_page.ajuster()`, appliquée au rapport *et* aux aperçus) :
  - rien ne descend sous **17,65 cm** (`LIMITE_BAS`), les logos du bas commencent à 17,90 cm ;
  - le pied de page (titre de la formation) est retiré ;
  - les tailles de texte sont **écrites en clair** : PowerPoint ne recalcule pas l'ajustement
    automatique (`normAutofit`, `spAutoFit`) tant que le texte n'est pas retouché ;
  - tailles uniformes d'une page à l'autre : une zone garde la taille du modèle, et si elle
    déborde tous ses textes perdent 2 pt à la fois (`PALIER`) : 16/22 → 14/20 → 12/18…,
    8 pt au minimum ;
  - une même partie garde la même taille sur tout le rapport : les zones d'une même famille
    (nom de forme + taille du modèle, `famille()`) prennent toutes le retrait de la plus longue
    (`besoins()` puis `service.paliers()`) ; l'aperçu d'un jour reçoit les autres jours
    (`voisines`) pour afficher la même taille que le rapport ;
  - les résumés de jour sont au moins à 14/20 (`STANDARDS`), même courts ;
  - tous les commentaires des résultats (« Rectangle » du modèle) sont à 12 pt
    (`CORPS_COMMENTAIRE`) ; s'ils débordent, ils remontent de 0,75 cm au plus puis diminuent ;
  - un tableau cède l'excès à sa dernière ligne ;
  - le numéro de page affiché suit le rang dans le rapport.
  - Estimation calibrée sur les corrections faites à la main dans PowerPoint
    (`CHASSE`, `INTERLIGNE`).
- **Légendes photos** (`photos.disposer()`) :
  - pas de bande pour une ligne de photos sans légende ;
  - deux voisines de même légende n'en portent qu'une, sur toute leur largeur ;
  - légende sur toute la largeur du cadre à 12 pt, sous une photo plus étroite à 11 pt ;
    réduites à 10 pt seulement si elles dépassent trois lignes (`LIGNES_LEGENDE`), un même
    corps par largeur sur la page ;
  - légende commune à 12 pt.

### Diapositives du modèle

| Page | Diapositive |
|---|---|
| Couverture | 1 |
| Participants | 3, 4 |
| Objectifs | 5 puis 6 (romain), 7 (puces), 8 (mixte) ou 9 (avec photos) |
| Déroulé | 10, puis 11 pour chaque jour (texte à gauche, photos à droite ; plus d'alternance avec 13) |
| Résultats, satisfaction | 16 à 19 |
| Bilan | 20 |
| Fiches | 25, puis 27 par stagiaire (formation) ou **26** par candidat (certification) |
| Clôture | 28 |

Sources : `DIAPO_PAR_PAGE` (`utils/diapositives.js`) et `DIAPOS` (`cfao-comptes-rendus/api/rendu/modele.py`).

**Ordre et intercalaires** — l'ordre des rapports de référence : couverture, participants
(photo de groupe), objectifs, déroulé, résultats / satisfaction / bilan, fiches, clôture.
Chaque section est précédée de son intercalaire (3, 5, 10, 16, 25), posé par
`avecIntercalaires` au moment de produire le rapport ; une section écartée ne laisse pas de trou
dans la numérotation 1 à 5. L'intercalaire 25 liste les stagiaires (nom complet, pays).

**Aperçu dans l'Explorateur** — le PPTX porte `docProps/thumbnail.jpeg` (256 px), l'image de sa
première page (`poser_vignette`, `cfao-comptes-rendus/api/rendu/service.py`), comme ceux que PowerPoint enregistre.

**Fiche de certification (26)** — conforme aux rapports G3 de référence : tableau « Filiale »,
une ligne `G38001: intitulé / 100` par module (note rouge sous 70), `Total/ N`, `Pourcentage(%)`
et case Validé / Échoué ; bloc e-learning ; appréciation ; bandeau
*Résultat pratique + E-learning = Résultat final* en vert / rouge.

**Qualité de la formation et de l'accueil (19 et 27)** — une note absente (aucune réponse des
présents) retire son tableau et son anneau du classeur Excel embarqué lui-même, pas seulement
de l'image : cellules, série du graphique, titre automatique ; l'étiquette de l'anneau restant
passe au centre. Sans aucune des deux notes, l'objet et sa pastille ou son titre de colonne
sont retirés de la page (`_sans_moitie_absente`, `cfao-comptes-rendus/api/rendu/classeurs.py`).

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

Stockage : base propre au service (`DATABASE_URL` : SQLite sur le volume `rapports-donnees` dans la
plateforme, PostgreSQL dans le compose du service seul). Photos : `$CR_DONNEES/photos/` (`/donnees`
en conteneur, ignoré par Git en local).

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

`cfao-comptes-rendus/api/redaction/` propose appréciations, bilans et constats à partir des notes
(`POST /apercu/redaction`). Il n'invente rien : sans donnée, la phrase correspondante disparaît.
Le texte proposé reste à relire par le formateur.

---

## 4. API du service

| Route | Effet |
|---|---|
| `GET /apercu/sante` | le service, le modèle et LibreOffice sont-ils prêts |
| `POST /apercu/page` | PNG d'une diapositive (`{diapo, valeurs}`) |
| `POST /apercu/rapport` | rapport complet, page par page (`{pages, format}`) |
| `POST /apercu/rapports`, `GET /apercu/rapports/<id>[/fichier]` | même rapport, préparé en tâche de fond puis téléchargé par un simple lien (`?nom=` donne le nom du fichier, sur le modèle des formateurs : « Compte rendu formation <intitulé> du 06-10.07.26 », « Compte rendu Certification pratique G3 PAYS du … » ; voir `nomCompteRendu`) ; les images des classeurs déjà rendus sortent du cache |
| `POST /apercu/document` | rapport complet à partir des parties |
| `POST /apercu/photo` | dépôt d'une photo, renvoie son identifiant |
| `POST /apercu/redaction` | texte proposé par le moteur |
| `POST /cr-donnees/connexion` | `{identifiant, motDePasse, seSouvenir}` → profil + cookie `cfao_session` (HttpOnly) |
| `GET /cr-donnees/session`, `POST /cr-donnees/deconnexion` | profil connecté (401 sinon), fermeture de la session |
| `GET/PUT/DELETE /cr-donnees/brouillons[/<id>]` | brouillons du compte connecté |
| `GET /cr-donnees/photos/<id>.jpg` | photo enregistrée |

Hors `sante` et les trois routes de connexion, tout répond 401 sans identité. Chaque route qui
touche une donnée interroge le Cerbos du service (`cfao-comptes-rendus/cerbos/`, refus par défaut).

### Identité des formateurs

Le service suit `DEPLOYMENT_MODE` :

- `integrated` (plateforme) : jeton Keycloak vérifié par les clés JWKS (`OIDC_ISSUER`,
  `OIDC_JWKS_URL`, `OIDC_AUDIENCE`) ; `/cr-donnees/connexion` renvoie vers la connexion de la
  plateforme (`OIDC_CONNEXION`). Le service refuse de démarrer sans `SECRET_KEY`, émetteur ni
  audience OIDC (l'audience est toujours vérifiée). Limite : tant que le BFF oauth2-proxy de la
  passerelle n'est pas activé, le navigateur n'envoie pas de jeton Bearer et le portail ne suit pas
  ce renvoi (revue 04-5, écart F6, `docs/revues/04-5-comptes-rendus.md`).
- `local` (poste unique servi sur le réseau interne, `DEBUG=False` obligatoire) : profils de
  `PROFILS_LOCAUX`, mot de passe vérifié à la connexion (empreintes de `COMPTES_LOCAUX`, format de
  l'ancien service) ; cinq échecs imposent une minute d'attente ; l'en-tête `X-User-ID` est ignoré.
  `manage.py mot_de_passe <identifiant>` crée ou remplace un mot de passe ; `manage.py
  exporter_flask --cible <dossier>` rend brouillons et photos à l'ancien service (retour arrière).
- `standalone` (poste de dev, `DEBUG=True` obligatoire) : profils fictifs de
  `cfao-comptes-rendus/api/profils-locaux.json`, choisis par leur identifiant, sans mot de passe ;
  cookie `cfao_session` signé (« Se souvenir de moi » : 30 jours, sinon 12 h au plus).

L'`id` du profil range les brouillons. Reprise des brouillons et photos de l'ancien service Flask :
`python manage.py importer_flask --source <dossier donnees> [--correspondance ids.json] [--essai]`
(`make rapports-importer SOURCE=/donnees` dans la plateforme). Le planning affiché ne retient que
les sessions dont le formateur est le compte connecté. Un rendu (aperçu, rapport) n'utilise que les
photos envoyées par le compte connecté ; une suppression retient la révision supprimée, et seule
une copie jamais enregistrée (révision 0) peut ensuite revenir sous le même id.

---

## 5. Démarrer en local

Prérequis : Node 20, Python 3.12, **LibreOffice** (Impress).

```bash
# Service (port 5175, mode autonome)
cd cfao-comptes-rendus/api
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py runserver 127.0.0.1:5175

# Interface (port 5174)
cd frontend && npm ci && npm run dev
# puis /portail/compte-rendu/nouveau avec un profil formateur
```

Variables : `CR_MODELE` (autre modèle), `CR_CACHE` (cache des images), `CR_SOFFICE` (chemin de
LibreOffice, par défaut celui de Windows), `CR_DONNEES` (photos). Configuration Django :
`cfao-comptes-rendus/.env.example`.

En conteneur : `docker compose up rapports gateway` (plateforme, mode intégré) ou
`cd cfao-comptes-rendus && make up` (service seul). L'image (multi-étapes, gunicorn, utilisateur
sans privilège) embarque LibreOffice et des polices métriquement compatibles (Liberation,
Carlito) ; un seul processus, car le verrou LibreOffice et les tâches de fond vivent en mémoire.
Le rendu Linux peut différer de quelques pixels du rendu Windows.

---

## 6. Tests

```bash
cd frontend && npm test              # Vitest : calculs, drapeaux, légendes
cd cfao-comptes-rendus/api && pip install -r requirements-dev.txt && pytest -q
cd cfao-comptes-rendus && make policy-test   # règles Cerbos du service
```

| Fichier | Couvre |
|---|---|
| `frontend/src/utils/certification.test.js` | pourcentage, seuil 70 %, résultat final, e-learning |
| `frontend/src/utils/diapositives.test.js` | drapeaux de la fiche de certification, code couleur |
| `frontend/src/data/dispositions_photos.test.js` | dispositions, modes de légende, anciens brouillons |
| `cfao-comptes-rendus/api/comptes_rendus/tests/test_service.py` | substitution, lignes répétées, couleurs, modèle versionné, rendu LibreOffice |
| `cfao-comptes-rendus/api/comptes_rendus/tests/test_brouillons.py` | contrat `/cr-donnees`, cloisonnement par utilisateur |
| `cfao-comptes-rendus/api/comptes_rendus/tests/test_mise_en_page.py` | limite des logos, pied de page, tailles en clair, légendes |

Le rendu LibreOffice est sauté en CI (LibreOffice absent du runner) ; il s'exécute en local.
**Les tests n'écrivent jamais dans un dossier de données réel** : base SQLite en mémoire.

---

## 7. Modifier le modèle PowerPoint

1. Ouvrir `cfao-comptes-rendus/api/rendu/modeles/MODELE-REFERENCES.pptx` dans PowerPoint.
2. Garder chaque drapeau **seul dans son run** (le retaper d'un bloc si PowerPoint le coupe).
3. Ne pas renuméroter les diapositives sans mettre à jour `DIAPO_PAR_PAGE` et `modele.py`.
4. Aucune donnée réelle (nom, photo) dans le modèle : il est anonymisé.
5. `pytest -q` (dans `cfao-comptes-rendus/api`) vérifie la présence des drapeaux de la fiche de certification.

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
