# cfao-needs — Identification des Besoins en Formations (app 16)

> **Module détachable.** Tout ce dont il a besoin est dans ce dossier : sa base, son
> Keycloak, son Cerbos, son worker, sa passerelle. `docker compose up` ici suffit,
> sur une machine vierge, sans le reste du dépôt.
>
> Spécification : [`../docs/SPEC_RECUEIL_BESOINS_2027.md`](../docs/SPEC_RECUEIL_BESOINS_2027.md)
> · Stories : [`../backlog.md`](../backlog.md) §16 · PERT : nœud **N**

---

## Démarrer

```bash
cp .env.example .env         # puis remplir les 5 secrets — aucun n'a de défaut
cp web/.env.example web/.env # Vite lit ces valeurs AU BUILD, pas au runtime
make build-web               # la passerelle sert web/dist, elle ne le construit pas
make up                      # le job needs-migrate crée la base : schéma, référentiel, démo
```

Aucune commande de migration ni de seed à lancer : à chaque `up`, le job ponctuel
`needs-migrate` exécute `manage.py bootstrap --demo` (AGENTS.md §7) puis s'arrête en 0 ;
l'API et le worker l'attendent. Rejoué sur une base à jour, il n'écrit rien ; sur une
base existante, il n'ajoute que ce qui manque. En production : `bootstrap` sans `--demo`.

Interface sur `http://localhost:8080`, Keycloak sur `http://localhost:8081`.

> `web/.env` est requis avant `make build-web`. Sans lui, `VITE_OIDC_ISSUER` vaut la
> chaîne vide et le bouton « Se connecter » pointe sur l'origine du SPA : nginx renvoie
> `index.html`, l'écran de connexion se réaffiche et **aucune erreur n'apparaît**.

### Comptes de recette

Six comptes, un par rôle du parcours, déclarés dans le realm. Mot de passe commun :
`NEEDS_DEMO_PASSWORD` — un placeholder `${...}` résolu à l'import, jamais une valeur
dans le dépôt (interdit n° 2). La substitution vient de
`-Dkeycloak.migration.replace-placeholders=true`, passé par `JAVA_OPTS_APPEND`.

| Compte | Rôle | Périmètre | Écrans |
|---|---|---|---|
| `chef.atelier@cfao.com` | workshop_manager | Douala · Toyota, Peugeot | saisie |
| `chef.equipe@cfao.com` | team_manager | Abidjan · Lovol, Hino | saisie |
| `team.lead@cfao.com` | team_manager | Accra · Toyota (locale `en`) | saisie |
| `directeur.cmr@cfao.com` | branch_director | Cameroun | suivi filiale |
| `assistante@cfao.com` | center_assistant | Groupe | relecture, à envoyer |
| `directeur.centre@cfao.com` | center_director | Groupe | relecture, arbitrage |

Trois couplages à ne pas casser :

- **`users[].id` du realm ↔ `PROFILES` de `seed_referential`.** Le `sub` OIDC est la
  seule jointure avec `referential.UserProfile` ; `LocalIdentityProvider` ne se rabat
  jamais sur l'email. Un `id` modifié d'un côté seulement donne une connexion réussie
  puis un refus sur tout : périmètre vide, policies en default-deny.
- **Le mapper d'audience du client `needs-web`.** L'API valide `aud = needs-web`
  (`OIDC_AUDIENCE`) ; sans ce mapper, Keycloak n'émet que `aud: account` et tout appel
  authentifié repart en 401.
- **`unmanagedAttributePolicy: ENABLED`** dans le composant user-profile. Depuis
  Keycloak 24, un attribut non déclaré est supprimé à l'import : `scopeNode`, `brands`
  et `locale` disparaîtraient du jeton en silence.

Le realm n'accepte aucune clé hors schéma — pas de commentaire possible dans le JSON,
d'où cette section.

### Écran de connexion

Le mot de passe se saisit chez Keycloak, jamais dans le SPA : c'est le flow
Authorization Code + PKCE, et c'est ce qui rend vraie la phrase « aucun mot de passe
côté application ». La redirection n'est donc pas contournable — le client a
`directAccessGrantsEnabled: false`, il n'a même pas le droit d'envoyer un mot de passe.
Le BFF prévu en R1 ne la supprime pas non plus : il déplace le jeton dans un cookie.

L'écran reprend en revanche la page `/login` du site vitrine : photo `hero/default.jpg`
et vignette, carte de verre, logo CFAO Mobility, bouton rouge en pilule. Le thème est
dans `keycloak/themes/cfao-needs/login` ; il hérite du thème Keycloak et surcharge le
CSS. Le realm est en `defaultLocale: fr` avec FR/EN au choix — sans
`internationalizationEnabled`, Keycloak sert l'anglais quoi qu'il arrive.

Les images et les polices sont **copiées** dans le thème, pas référencées dans
`frontend/` : le module doit rester montable seul. Space Grotesk et DM Sans sont
embarquées en woff2 (96 Ko, polices variables, un fichier par sous-ensemble) plutôt que
servies par Google — la page de connexion d'un outil interne n'appelle pas l'extérieur,
même raisonnement que `CERBOS_NO_TELEMETRY`.

Le favicon est fourni par le thème (`resources/img/favicon.ico`, la sphère du logo).
Sans ce fichier, l'héritage de thème sert celui du parent et l'onglet affiche le logo
Keycloak — ce n'est pas réglable en CSS, il faut le fichier.

Deux écarts avec la vitrine, imposés par le gabarit FreeMarker de Keycloak : les
libellés restent au-dessus des champs, le label flottant supposant un `<label>` placé
après l'`<input>`, et il n'y a pas de particules animées. Le logo est injecté en
`::before` sur l'en-tête de la carte — aucun template n'est surchargé, ce qui évite
d'avoir à le rejouer à chaque montée de version de Keycloak.

`start-dev` désactive le cache de thèmes : une retouche de `resources/css/cfao.css` est
visible au rechargement de la page, sans redémarrer le conteneur. Les libellés vivent
dans `messages/messages_fr.properties`, limités à ceux que l'utilisateur relit ensuite
dans le SPA.

Enfin, le job laisse la campagne en brouillon, comme en production où l'ouverture
est un geste tracé du directeur du centre. Pour une recette immédiatement saisissable :

```bash
make seed-demo-open
```

### Titres anglais du catalogue

Le fichier de travail métier n'a qu'une colonne d'intitulé, en français. Les titres
anglais viennent de `api/referential/data/titles_en.json`, rapproché du catalogue publié
sur la vitrine (`frontend/`). La table est **indexée sur l'intitulé, pas sur le code** :
`TP01` et `TP02` désignent des formations différentes — et inversées — selon la famille.

```bash
node scripts/build-titles-en.mjs                        # régénère depuis la vitrine
docker compose exec needs-api python manage.py backfill_titles_en   # applique à une base existante
```

Le générateur conserve les traductions saisies à la main pour les formations que la
vitrine ne publie pas. Un intitulé sans traduction s'affiche en français : rien ne bloque.

### Niveaux constructeur

Le fichier 2027 ne porte que JUNIOR / SENIOR / EXPERT (paliers MEDACAP). L'écran de
saisie affiche la nomenclature de chaque marque — G4→G1 (Toyota), Bronze→Gold (Suzuki),
BASIC (Mercedes) — reprise de `frontend/src/data/training-catalog.json`.

```bash
node scripts/build-levels.mjs
docker compose exec needs-api python manage.py backfill_level_labels
```

```bash
make test          # tests Python
make policy-test   # tests Cerbos — positifs ET négatifs
```

**En intégration continue** : les jobs `cfao-needs (app 16 · Django · pytest)`,
`cfao-needs (app 16 · Vite · build)` et l'étape « app 16 » du job Policies Cerbos.
La CI se déclenche à l'ouverture de la pull request — une branche de feature poussée
seule ne déclenche rien (`.github/workflows/ci.yml`).

---

## Arborescence

```
cfao-needs/
├── docker-compose.yml      ← la stack complète, 7 services
├── .env.example            ← forme des variables, jamais de secret réel
├── Makefile
│
├── api/                    ← service Django (API + worker, même image)
│   ├── config/settings/    base · dev · test
│   ├── core/               socle repris de cfao-core
│   │   ├── auth/           oidc · principal · identity  ← la bascule standalone/integrated
│   │   ├── authz/          cerbos · permissions · filters · viewsets
│   │   └── imports/        LE PATRON D'IMPORT TABULAIRE (columns · base · template)
│   ├── referential/        familles, marques, alias, organisation, profils
│   ├── campaigns/          campagne · catalogue · soumissions · besoins
│   │   ├── services/       summary · transitions
│   │   └── imports/        catalog  ← clé (famille, marque, code)
│   └── outbound/           file de sortie et emails
│       ├── catalog.py      ← le catalogue des messages ET la règle d'envoi
│       └── services/       queue · render · backends · sender
│
├── cerbos/
│   ├── policies/           needs_campaign · needs_line · needs_submission · needs_outbound
│   └── tests/              positifs + négatifs (obligatoires)
│
├── keycloak/               realm en config-as-code
│   └── themes/cfao-needs/  écran de connexion — port du /login de la vitrine
├── gateway/                nginx : sert la SPA, route l'API
└── web/                    SPA React/Vite
```

---

## Les trois règles qui structurent le code

### 1 · Rien ne sort sans relecture

Aucun email ne part vers une filiale sans qu'un membre de l'équipe Academy l'ait
validé dans la plateforme.

```
① le manager soumet
        │  seul envoi automatique — et il est INTERNE
        ▼
② l'équipe Academy reçoit un résumé + un lien profond
        ▼
③ elle relit la fiche dans la plateforme
        ▼  « Valider »
④ confirmation à l'auteur, SES destinataires en copie
```

Ce n'est pas une convention, c'est un invariant tenu à trois niveaux :

| Où | Quoi |
|----|------|
| [`outbound/catalog.py`](api/outbound/catalog.py) | Chaque type déclare son audience et son mode ; `assert_catalog_is_safe()` **fait échouer le démarrage** si un type externe est en `AUTO` |
| [`outbound/services/queue.py`](api/outbound/services/queue.py) | `enqueue()` revérifie les **adresses réelles** — un type interne avec un destinataire externe bascule en relecture |
| [`cerbos/policies/resource_policies/needs_outbound.yaml`](cerbos/policies/resource_policies/needs_outbound.yaml) | `DENY` explicite sur tous les rôles de filiale |

### 2 · La clé naturelle est `(famille, marque, code)`

Le fichier de référence compte **261 lignes pour 231 codes distincts** : `TP02`
existe à l'identique sur dix marques. Dédoublonner sur `code` seul perd 30 lignes,
en silence.

`brand` est **nullable** (formation transverse). PostgreSQL ne considérant pas deux
`NULL` comme égaux, l'unicité passe par deux contraintes partielles — voir
[`campaigns/models.py`](api/campaigns/models.py).

Le test qui garde cette règle :
`campaigns/tests/test_catalog_import.py::test_meme_code_sur_dix_marques_donne_dix_lignes`.

### 3 · Une famille sans catalogue s'affiche mais ne se saisit pas

Les catalogues arrivent progressivement. `CatalogFamily.status` vaut `READY`,
`PENDING` ou `HIDDEN` : la campagne s'ouvre **sans attendre le dernier catalogue**,
et chaque famille se branche par un simple import — pas de migration, pas de
redéploiement.

---

## Détachabilité — comment ça marche

Un seul point du code connaît la différence entre les deux modes :
[`core/auth/identity.py`](api/core/auth/identity.py).

| | `standalone` | `integrated` |
|---|---|---|
| Identité | Keycloak embarqué, realm `cfao-needs` | Keycloak plateforme |
| Autorisation | Cerbos embarqué | Cerbos plateforme, mêmes policies |
| Périmètre | `referential.UserProfile` (import) | `identity` plateforme (`GET /me`, cache 60 s) |
| Catalogue | table locale (import) | synchronisé depuis `lms.Course` |

Le basculement se fait par `NEEDS_DEPLOYMENT_MODE`, jamais par modification de code.

---

## Budget de ressources

Chaque service déclare son plafond, **calibré sur une mesure** — norme projet
(`../planning.md` §7, `../architecture.md` §7).

Mesures au repos, médiane sur 5 relevés (un échantillon unique attrape les sondes et
ment d'un ordre de grandeur).

| Service | CPU | Mémoire | Plafond |
|---------|----:|--------:|--------:|
| needs-keycloak | 0,3 % | 337 Mio | 768 Mio |
| needs-api | 0,01 % | 103 Mio | 512 Mio |
| needs-worker | 0,9 % | 82 Mio | 384 Mio |
| needs-cerbos | 1,5 % | 38 Mio | 256 Mio |
| needs-db | 0,9 % | 23 Mio | 512 Mio |
| needs-kc-db | 0,1 % | 19 Mio | 256 Mio |
| needs-gateway | 0 % | 3 Mio | 64 Mio |
| **Total** | **~3,7 %** | **~605 Mio** | 2,7 Gio |

**Avant réglages : ~950 Mio et ~11 % de CPU, avec des pics à 165 %.**

Quatre valeurs par défaut ramenées à l'usage réel :

| Réglage | Défaut | Ici | Gain |
|---|---|---|---|
| Tas JVM Keycloak | libre (524 Mio) | `-Xmx256m` | −190 Mio |
| Workers gunicorn | 3 | 2 | −60 Mio |
| Django-Q `guard_cycle` | 0,5 s | 5 s | 4 % → 0,9 % |
| Sondes de santé | 10–15 s | 20–30 s, `python -S` | pics 165 % → 0 |

> La sonde de l'API coûtait plus cher que l'API elle-même : un interpréteur Python
> lancé toutes les 15 s, pour un service à 0,01 % d'usage réel.

Pas de limite CPU : le throttling est silencieux et se diagnostique mal. On agit sur la
cause, pas sur le symptôme.

---

## Les onze interdits

Repris de l'audit Academix ([`../docs/AUDIT_ACADEMIX.md`](../docs/AUDIT_ACADEMIX.md) §4).
Chacun est un contrôle, pas une consigne.

| # | Interdit | Où c'est tenu |
|---|----------|---------------|
| 1 | Mot de passe stocké | Aucune colonne mot de passe — Keycloak est seul dépositaire |
| 2 | Identifiants dans le dépôt | Gitleaks en CI · `.gitignore` |
| 3 | Secret par défaut en dur | `settings/base.py` — `env("NEEDS_SECRET_KEY")` sans défaut : **le boot échoue** |
| 4 | `.env` versionné | `.gitignore` |
| 5 | CORS ouvert | `CORS_ALLOWED_ORIGINS` explicite, jamais `*` |
| 6 | Rôle lu côté client | Le SPA n'utilise le JWT que pour l'affichage ; toute décision vient de l'API |
| 7 | Deux chemins d'authentification | Un seul middleware, un seul code d'erreur (401) — `core/auth/oidc.py` |
| 8 | Endpoint sans PEP | `CerbosPermission` sur chaque vue ; pas de `cerbos_resource_kind` ⇒ refus |
| 9 | Dépendance vulnérable | `pip-audit` en CI ; `openpyxl` côté serveur, jamais `xlsx` côté navigateur |
| 10 | Migration + seed au démarrage | Entrypoint = gunicorn seul ; job ponctuel `needs-migrate` (`bootstrap`, créer seulement), attendu par l'API et le worker |
| 11 | Envoi automatique vers l'extérieur | `assert_catalog_is_safe()` au boot |

---

## État R0

| | |
|---|---|
| ✅ | Arborescence, socle Django, `docker-compose.yml`, realm Keycloak, passerelle |
| ✅ | Modèle de données complet (familles, campagne, catalogue, soumissions, besoins, file de sortie) |
| ✅ | Patron d'import tabulaire + importeur de catalogue — **10 tests passent** |
| ✅ | Circuit d'envoi à validation — **10 tests passent** |
| ✅ | Policies Cerbos `needs_*` — **58 tests exécutés, 58 verts** (positifs et négatifs) |
| ✅ | **SPA — parcours filiale en 3 pages + 3 écrans Academy**, build Vite vert |
| ✅ | **Bilingue FR/EN** — 137 clés utilisées, catalogues stricts et alignés (aucune manquante) |
| ✅ | Seeds — **259 lignes du catalogue 2027 réel**, 21 marques, 8 familles, 28 modèles d'emails (14 clés × 2 langues) |
| ✅ | **Stack complète démarrée et vérifiée** — 7 conteneurs, realm importé, décisions Cerbos live, SPA servie, 401 sans jeton |
| ⏳ | Relances et regroupement par inactivité (tâches planifiées) — **R1** |

### Les écrans

Côté filiale, le parcours tient en **trois pages** — connexion, BU et marques,
formations de la marque. Un DPS ou un manager n'en voit pas d'autres : on ouvre
une marque, on saisit, on revient, et on transmet une fois depuis le bas de
l'écran des marques. Il n'y a **pas** d'écran de récapitulatif ni de suivi
séparés ; les totaux, les destinataires en copie et l'état de la fiche vivent au
pied de l'écran des marques.

| Route | Écran | Rôle |
|-------|-------|------|
| *(Keycloak)* | Connexion | Filiale + Academy |
| `/` | BU et marques par BU — compteurs, totaux, destinataires en copie, envoi | Filiale |
| `/marque/:code` | Formations de la marque : T1–T4 × effectif + lieu, groupées par niveau, brouillon serveur | Filiale |
| `/relecture` | Fiches à relire, ancienneté, alerte SLA 48 h | Academy |
| `/relecture/:id` | Fiche : récapitulatif, lignes, valider / réouvrir | Academy |
| `/a-envoyer` | File d'envoi : prévisualisation, approbation par lot, rejet motivé | Academy |
