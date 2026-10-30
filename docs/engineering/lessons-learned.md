# Lessons learned : mémoire des erreurs (RAIDER, failure memory)

Mémoire consultable des erreurs et des near misses significatifs du projet, exigée par le principe **D** de [RAIDER.md](../../RAIDER.md). Tout contributeur la **lit avant** toute évolution proche d'un incident connu, et l'**enrichit après** chaque erreur ou near miss (revue, test, CI, prod, remarque de l'utilisateur).

Une correction n'est complète que si elle s'accompagne d'une **prévention** proportionnée : test, validation, guardrail CI, règle ou checklist. Une erreur qui revient alors qu'elle est déjà documentée signifie que la prévention était insuffisante. Dans ce cas, on **renforce le contrôle** (on passe par exemple d'une règle écrite à un test, puis à un blocage CI), on ne réapplique pas le même correctif.

## Règles retenues (synthèse, à relire en premier)

| Règle | RAIDER | Prévention vérifiable |
|---|---|---|
| Toute file de tâches a son consommateur déclaré dans le déploiement | D, E | smoke test Docker : un message passe à `SENT` |
| Une donnée qui arrive par plusieurs chemins est validée au point de convergence | E | tests sur chaque chemin d'arrivée |
| Une route n'est publiée que si un client externe identifié en a besoin | E (moindre privilège) | test ou revue de `gateway/nginx.conf` |
| Un contrat publié est testé contre le serveur | D, E (contrats explicites) | test `jsonschema` contre les réponses du serveur |
| « Les tests passent » se prouve depuis un clone propre, avec la commande documentée | A, D | `make test-*` sans variable d'environnement |
| L'idempotence se garantit par une contrainte en base | I | test de double appel, contrainte d'unicité |
| Un job CI ne tourne que si ses fichiers changent | E (exécution proportionnelle) | filtre de chemins testé |
| Un service écrit dans Compose n'est prouvé que par une exécution observée | D | sortie collée dans le walkthrough (échec compris) |
| La commande documentée doit exister sur la machine qui produit la preuve | A | `make` présent dans le PATH, sinon le trou est écrit |
| Une action CI qui appelle l'API GitHub reçoit le droit explicite dont elle a besoin | E (moindre privilège) | test du workflow (`pull-requests: read` sur `changes`) + run observé |
| Une policy se relit pour le realm où elle tourne : ni `roles: ["*"]` en lecture large, ni DENY par rôle sans test de rôles cumulés | E (moindre privilège) | tests Cerbos « comptes externes » et « rôles cumulés », prouvés par mutation |
| Un émetteur de jeton se compare à l'identique, contre une liste déclarée ; un hôte différent est une entrée de plus, jamais un suffixe ni une réécriture | E, R | `test_jwt_verifier.py` (même realm sur un autre hôte refusé), copies identiques vérifiées en CI |
| Une audience vérifiée par une API est produite par un mapper du realm, et un secret de client n'a qu'une source | E, D | `keycloak/tests` (cohérence statique) + smoke sur Keycloak 26 (jetons réels, config dev et prod) |
| Une donnée de dev (comptes, mots de passe) vit dans un emplacement que la prod n'importe pas, jamais derrière un simple commentaire | E, D | `test_realm_de_prod_sans_aucun_compte` + smoke prod sur Keycloak neuf (`DEMO_ATTENDUE=absente`) |
| Une image publiée contient les octets testés ; les fins de ligne sont fixées par le dépôt, pas par le poste | D, A | `.gitattributes` `eol=lf` + `diff -r` export/testé avant push |
| Un serveur qui calcule ses URL depuis la requête est servi sous le même chemin que son URL publique ; un proxy ne retire jamais son préfixe | E, R | `edge/tests/smoke_edge.py` : `token_endpoint` de la découverte commence par `<passerelle>/auth/`, même avec un Host falsifié |
| Un fichier dont le CI dépend est prouvé présent dans le dépôt ; une exception se règle dans `.gitignore`, jamais par `git add -f` | D, A | `test_modeles_d_environnement_suivis_par_git` |
| Une ressource servie avec cache se vérifie avec le client réel, sur un marqueur que seule la nouvelle version contient | D | contrôle Playwright du thème (`.cfao-close` présent) |
| Un élément d'interface se prouve visible (couleur calculée contre son fond), pas seulement présent dans le DOM | E | `keycloak/tests/test_theme.py` + couleur calculée du ✕ relevée par Playwright |
| Un modèle `.env` partagé par plusieurs fichiers compose laisse vides les variables dont le défaut diffère selon le mode ; le déploiement refuse une valeur incompatible | A, D | `test_modele_env_laisse_l_audience_au_compose` + garde `OIDC_AUDIENCE` dans `deploy.sh/.ps1` |
| Un changement de cible d'un tunnel nommé se répète d'abord sur un nom jetable ; on attend que l'ancien partage ait disparu côté API avant de recréer, et on recrée par l'agent, jamais en `--subordinate` à la main | D, I | `zrok2 list names` sans jeton de partage avant recréation ; `zrok2 agent status` + `agent-registry.json` montrent la nouvelle cible |
| Toute frontière inter-modules est déclarée dans `contracts/registry.json`, avec test fournisseur et test consommateur | D, E (contrats explicites) | job CI `contracts` + tests consommateur de chaque module |
| Un fichier dérivé d'une source (labels, spec publiée) est réconcilié par un outil qui n'écrit que son bloc et seulement s'il dérive | I, R | `contracts/sync.py --check` en CI + test de second passage sans écriture |
| Une table lue par une application est portée par son modèle et sa migration, jamais par un script hors bande seul | D, R | test sur données réelles + migration qui adopte une table préexistante, rejouée sur Postgres |
| Un relais public vers un service multi-tenant nomme le tenant exposé (liste blanche), jamais une famille de chemins | E (moindre privilège) | `edge/tests/smoke_edge.py` : `/auth/realms/master/…` et tout autre realm en 404 |

## Entrées

<!-- Plus récentes en haut. On n'efface ni ne réécrit une entrée : on corrige par une nouvelle entrée qui la référence. -->

### 2026-10-30 — Realm master du Keycloak commun exposé sur Internet par la passerelle
- **Contexte / symptôme** : à l'activation de `EDGE_KEYCLOAK_UPSTREAM` sur le serveur, `https://academy-server.shares.zrok.io/auth/realms/master/.well-known/openid-configuration` répond 200 (Keycloak). La console d'admin était bien en 404, mais le point de jeton du realm master (`admin-cli`, mot de passe) était joignable.
- **Impact** : environ 2 minutes d'exposition. La connexion admin pouvait être tentée en force brute depuis Internet. Aucun utilisateur ne passait par cette route. Le relais a été coupé dès la détection.
- **Détection** : vérification manuelle après déploiement (liste de chemins sensibles via l'URL publique).
- **Cause racine** : `location ~ ^/auth/(realms|resources)/` relaie tous les realms. Le smoke ne vérifiait que la console et les métriques, et aucun test ne demandait un realm autre que `cfao`.
- **Correctif** : `^/auth/(realms/cfao|resources)/` (cfao-edge v0.1.1). Tout autre realm tombe sur le 404 de `/auth/`.
- **Prévention** : `test_surface_auth_reduite` couvre maintenant `/auth/realms/master/…` (découverte et jeton) et un realm voisin (`cfao-autre`). La liste blanche des routes de `test_edge_config.py` fige l'expression.
- **Leçon généralisée** : devant un service multi-tenant, la route publique nomme le tenant. Un préfixe générique expose aussi les tenants d'administration.
- **Catégorie** : sécurité / configuration
- **Récidive** : non

### 2026-10-29 — Bascule zrok vers la passerelle : ~3 min de coupure du lien public
- **Contexte / symptôme** : pour repointer `academy-server` de `127.0.0.1:8080` (needs) vers `127.0.0.1:8086` (cfao-edge), on a enchaîné `zrok2 agent release share 8vf1hzzamkg5` puis la création d'un partage. Résultat : 409 `shareConflict` (nom encore lié à l'ancien partage). Ensuite, une recréation lancée à la main avec `--subordinate` a tourné hors agent, dans la session SSH (absente de `agent status` et du registre), et il a fallu la refaire.
- **Impact** : lien public coupé de 18:28 à 18:32 UTC environ. Aucun utilisateur touché (personne sur zrok à ce moment ; le LAN passe par le serveur en direct).
- **Détection** : erreur 409 au premier essai ; `zrok2 agent status` vide alors que l'URL publique répondait.
- **Cause racine** : la libération d'un partage est asynchrone côté API (`delete share` répond 404 alors que le nom reste lié quelques secondes). `--subordinate` est le mode interne du processus lancé par l'agent, pas une option pour lui confier un partage.
- **Correctif** : partage `fsek0mu1uksq` créé par `zrok2 share public -b proxy -n public:academy-server http://127.0.0.1:8086` (détection de l'agent), registre à jour. URL locale du watchdog passée à 8086 (sauvegarde dans `~/deploy-backups/zrok-20261029-182832`).
- **Prévention** : procédure en trois temps : libérer, attendre que `zrok2 list names` ne montre plus de jeton sur le nom, recréer sans `--subordinate`. Contrôler ensuite avec `zrok2 agent status`, le registre et l'URL publique. Retour arrière, même procédure avec la cible 8080.
- **Leçon généralisée** : une opération distante présentée comme « libérer puis recréer » n'est pas atomique. On attend l'état observé, pas le code de retour, avant l'étape suivante.
- **Catégorie** : release/déploiement
- **Récidive** : non

### 2026-10-29 — Le ✕ de la page de connexion était blanc sur fond blanc
- **Contexte / symptôme** : revue utilisateur de la page de connexion. Le rond blanc du ✕ apparaissait sans croix.
- **Impact** : aucun en prod (pas encore publié). Le seul moyen visible de quitter la page était invisible.
- **Détection** : capture de l'utilisateur. Puis Playwright : couleur calculée `rgba(255, 255, 255, 0.88)` sur un fond `rgb(255, 255, 255)`.
- **Cause racine** : la règle générale `.login-pf-page a` fixe `color` et `font-size` en `!important`. Le ✕ est devenu un lien `<a>` (commit `b660079`), et sa règle sans `!important` perdait. La recette vérifiait que `.cfao-close` était présent, pas qu'il était lisible.
- **Correctif** : `color` et `font-size` en `!important` sur `.cfao-close`, ainsi que la couleur de survol.
- **Prévention** : `keycloak/tests/test_theme.py` vérifie que le ✕ impose au moins ce que la règle des liens impose. Le test a été prouvé par mutation : il échoue sans le `!important`. Une recette d'interface relève la couleur calculée face au fond.
- **Leçon généralisée** : changer la balise d'un élément (un `::after` devenu un `<a>`) le fait entrer dans de nouvelles règles générales. Présent dans le DOM ne veut pas dire visible.
- **Catégorie** : interface / CSS
- **Récidive** : non

### 2026-10-29 — Thème Keycloak : nouveau fichier sur le disque, ancien fichier servi au navigateur
- **Contexte / symptôme** : aperçu du thème `cfao-academy` après copie des fichiers dans le Keycloak en marche. `curl` recevait le nouveau `login.js`, le navigateur l'ancien : le lien ✕ n'apparaissait pas.
- **Impact** : aucun, relevé en vérification locale. Une capture prise sans contrôle aurait « validé » l'ancien thème.
- **Détection** : Playwright, `fetch` du script depuis la page (676 octets, sans `cfao-close`) comparé à la réponse de `curl`.
- **Cause racine** : Keycloak 26 garde une copie gzip des ressources du thème (`data/tmp/kc-gzip-cache`), servie aux clients qui acceptent la compression. Les URL portent une version fixe par version de Keycloak (`/resources/ypvoo/...`) avec `max-age=2592000` : le navigateur garde aussi l'ancien fichier 30 jours.
- **Correctif** : cache gzip vidé pour l'aperçu. Le thème n'est livré que par une image neuve (cache vide au démarrage).
- **Prévention** : la vérification d'un thème se fait dans un vrai navigateur, sur un élément que seule la nouvelle version contient. Dette ouverte : une modification de thème après la première mise en prod reste en cache 30 jours chez les utilisateurs. Il faudra réduire `static-max-age` ou versionner les noms de fichiers, et le prouver par smoke.
- **Leçon généralisée** : un serveur qui met ses ressources en cache peut en servir une autre version que celle du disque, selon les en-têtes du client. On vérifie avec le client réel, et une ressource modifiable change d'URL ou a une durée de cache courte.
- **Catégorie** : déploiement / cache

### 2026-10-29 — Audience du realm de module imposée à la prod par le `.env` (needs sur l'émetteur commun, L6)
- **Contexte / symptôme** : needs basculé sur le realm `cfao` ; connexion, jeton, `iss` et `aud` corrects, mais l'API répondait 401 (`InvalidAudienceError`). Le conteneur avait `OIDC_AUDIENCE=needs-web` alors que le compose de prod déclare `${OIDC_AUDIENCE:-cfao-needs-api}`.
- **Impact** : aucun, relevé en recette locale (`recette_needs.py` 15/17). En prod, tout appel à l'API aurait été refusé après la bascule.
- **Détection** : recette de bout en bout avec de vrais jetons, journaux de l'API.
- **Cause racine** : `cfao-needs/.env.example` fixait `OIDC_AUDIENCE=needs-web` (valeur du mode autonome). Compose lit `.env` d'office et une valeur non vide écrase le défaut de chaque fichier compose.
- **Correctif** : `OIDC_AUDIENCE=` vide dans le modèle ; `deploy.sh/.ps1` refusent une audience qui ne contient pas `cfao-needs-api`.
- **Prévention** : `test_modele_env_laisse_l_audience_au_compose` ; garde des scripts de déploiement vérifiée sur `needs-web` (refus) et valeur vide (accepté).
- **Leçon généralisée** : un `.env` commun à plusieurs modes ne fixe pas une valeur propre à l'un d'eux ; le défaut vit dans le fichier compose du mode. Une valeur incompatible est refusée au déploiement, pas découverte au premier 401.
- **Catégorie** : configuration / déploiement

### 2026-10-29 — Modèle `.env.prod.example` de la passerelle ignoré par git, lu par le CI
- **Contexte / symptôme** : `edge/.env.prod.example` existait sur le poste, mais `.gitignore` (`.env.*`) l'excluait. Le commit `8f688dd` ne le contenait pas. Le job CI `edge` le lit (`nginx -t --env-file`, tests statiques).
- **Impact** : aucun, relevé avant push. Le CI aurait échoué sur un fichier introuvable, et la procédure de prod pointait vers un modèle absent du dépôt.
- **Détection** : `git status` vide sur le fichier modifié, au commit suivant.
- **Cause racine** : le modèle de Keycloak avait été ajouté de force (`git add -f`), sans règle durable. Le cas suivant est retombé sous la règle générale.
- **Correctif** : exception `!.env.prod.example` dans `.gitignore`, fichier ajouté.
- **Prévention** : `test_modeles_d_environnement_suivis_par_git` (`git ls-files --error-unmatch`), vu échouer avant l'ajout.
- **Leçon généralisée** : un fichier dont le CI dépend est prouvé présent dans le dépôt, pas sur le poste. Une exception se règle dans `.gitignore`, jamais par `git add -f`.
- **Catégorie** : dépôt / CI

### 2026-10-29 — Keycloak derrière un préfixe retiré par le proxy aurait annoncé de mauvaises URL (passerelle commune)
- **Contexte / symptôme** : première idée pour publier le Keycloak commun sous `/auth` : le proxy retire `/auth` avant de relayer. Avec le backchannel dynamique, Keycloak calcule `token_endpoint`, `jwks_uri` et les redirections depuis le chemin reçu. La découverte aurait annoncé `https://<hôte>/realms/cfao/...`, chemin qui part vers l'ancien Keycloak de needs.
- **Impact** : aucun, relevé en revue de conception avant tout code. Un client OIDC (oauth2-proxy, SPA) lisant la découverte aurait échoué.
- **Détection** : relecture du plan par l'agent architecte, contre `compose.prod.yml` (`KC_HOSTNAME_BACKCHANNEL_DYNAMIC`).
- **Cause racine** : supposer qu'un reverse proxy peut masquer un préfixe à un serveur qui construit ses URL absolues à partir de la requête.
- **Correctif** : l'image v0.3.0 est servie sous `KC_HTTP_RELATIVE_PATH=/auth` (gestion 9000 laissée à la racine) ; la passerelle conserve le préfixe et impose l'hôte public (jamais le Host reçu).
- **Prévention** : `test_image_servie_sous_auth` (statique) et `smoke_edge.py` (vrai Keycloak derrière la vraie passerelle, Host falsifié).
- **Leçon généralisée** : un serveur qui calcule ses URL depuis la requête est servi sous le même chemin que son URL publique ; un proxy ne retire jamais son préfixe.
- **Catégorie** : conception / réseau
- **Récidive** : non

### 2026-10-29 — Image publiée à partir d'octets différents de ceux testés (Keycloak commun v0.1.0)
- **Contexte / symptôme** : `cfao-keycloak:v0.1.0` est construite depuis `git archive` du commit, pour ne pas embarquer le dossier de travail. Avec `core.autocrlf=true`, l'archive sort le realm en CRLF. Le smoke, lui, avait tourné sur le dossier de travail, en LF.
- **Impact** : faible. YAML tolère CRLF et le smoke de `v0.1.0` est vert. Mais le tag publié ne contenait pas exactement les fichiers testés. `v0.1.0` est remplacée par `v0.2.0` et n'est pas déployée.
- **Détection** : `diff -r` entre l'export et le dossier de travail, fait avant le build de `v0.2.0`.
- **Cause racine** : la conversion des fins de ligne dépend d'un réglage du poste (`core.autocrlf`) et non du dépôt.
- **Correctif** : `.gitattributes` : `keycloak/** text=auto eol=lf`. `v0.2.0` est construite depuis un export identique octet pour octet au dossier testé.
- **Prévention** : `git -c core.autocrlf=true archive HEAD keycloak/config/cfao-realm.yaml | tar -xO | grep -c $'\r'` renvoie 0. Avant tout push, `diff -r` entre l'export et ce qui a été testé.
- **Leçon généralisée** : un artefact publié se construit à partir des octets testés. Toute transformation entre test et build (export, fins de ligne, filtres) est fixée par le dépôt, pas par le poste.
- **Catégorie** : release/déploiement
- **Récidive** : non

### 2026-10-29 — Le realm destiné à la prod embarquait 11 comptes de démo au mot de passe « demo » (fédération L5)
- **Contexte / symptôme** : `keycloak/config/cfao-realm.yaml`, le fichier que keycloak-config-cli applique, contenait sous l'en-tête « DEV uniquement » 11 comptes au mot de passe `demo` non temporaire, dont `admin.groupe` et `moa.pilotage`. Rien ne séparait la dev de la prod : le même glob `/config/*.yaml` les importait partout.
- **Impact** : near miss. Le premier déploiement du realm commun sur le serveur aurait ouvert des comptes privilégiés à mot de passe connu.
- **Détection** : préparation de la migration des comptes (L5), en lisant le format des utilisateurs du realm.
- **Cause racine** : une restriction d'environnement écrite en commentaire, sans mécanisme qui l'applique ni test qui la vérifie.
- **Correctif** :
  - les comptes de démo passent dans `keycloak/config/dev/` ;
  - le compose de dev les importe par défaut (`KC_IMPORT_LOCATIONS`), la prod importe `/config/*.yaml` seul ;
  - le smoke prod tourne sur un Keycloak neuf, avec un seul compte de test (`tests/fixtures/`).
- **Prévention** :
  - `test_realm_de_prod_sans_aucun_compte` vérifie qu'il n'y a ni `users` ni `credentials` dans le realm ;
  - `test_comptes_de_demo_isoles_dans_dev` ;
  - le smoke prod avec `DEMO_ATTENDUE=absente` interroge l'admin API pour confirmer l'absence de `brahim.tahir` ;
  - le job CI vérifie `--force-recreate`.
- **Leçon généralisée** : « DEV uniquement » ne protège que si c'est un emplacement ou un drapeau que le déploiement de prod exclut, et qu'un test le vérifie.
- **Catégorie** : Sécurité / authentification
- **Récidive** : non

### 2026-10-28 — Audience exigée qu'aucun mapper ne produisait, secret BFF en double (fédération L3)
- **Contexte / symptôme** : le service des comptes rendus exigeait `aud = cfao-portal` dans le compose racine, mais le realm `cfao` n'avait aucun mapper d'audience : Keycloak met le client demandeur dans `azp`, pas dans `aud`. Le secret du client `cfao-portal` était écrit en dur dans le realm (`dev-portal-secret`) et, en parallèle, dans `.env` pour oauth2-proxy (`OAUTH2_PROXY_CLIENT_SECRET`), avec des valeurs différentes.
- **Impact** : near miss. En mode intégré, les comptes rendus auraient refusé tous les jetons du portail, et le BFF n'aurait pas pu échanger son code dès que `.env` diffère du littéral. Rien ne le montrait avant un vrai login.
- **Détection** : lot L3, en écrivant le smoke qui obtient de vrais jetons et les vérifie avec la lib commune.
- **Cause racine** : realm et consommateurs (APIs, BFF) configurés à deux endroits sans test commun ; le realm n'était jamais appliqué ni interrogé en test.
- **Correctif** : un client `cfao-<module>-api` bearer-only et un scope `aud-cfao-<module>-api` par API, portés par les clients qui l'appellent ; audiences explicites dans le compose (core, comptes rendus, operations). Secret du BFF et activation de `cfao-spa` injectés par substitution (`$(env:…)`), une seule source (`OAUTH2_PROXY_CLIENT_SECRET`).
- **Prévention** : `keycloak/tests/test_realm_config.py` (rôles = catalogue core et ⊇ policies Cerbos, audiences, session 8 h, aucun secret littéral ; 4 mutations détectées) ; `smoke_realm.py` sur Keycloak 26 éphémère, en config dev puis prod (`CFAO_SPA_ENABLED=false`, secret injecté) ; job CI `realm`.
- **Leçon généralisée** : un contrôle côté consommateur (audience, secret) n'existe que si le fournisseur le produit ; on le prouve par un échange réel, pas par la lecture des deux configurations.
- **Catégorie** : Sécurité / authentification
- **Récidive** : non

### 2026-10-28 — Trois vérifications de jeton divergentes, dont une acceptait tout hôte (fédération identité)
- **Contexte / symptôme** : les modules core, needs, planning et comptes rendus vérifiaient chacun le JWT à leur façon. needs et planning acceptaient tout émetteur finissant par `/realms/<module>`. core réécrivait `keycloak:8080` en `localhost:8080`, et n'avait aucun contrôle d'émetteur sans `OIDC_ISSUER`. needs affichait en `print` l'émetteur et l'erreur de chaque refus.
- **Impact** : near miss. Un émetteur sur n'importe quel hôte passait le contrôle d'émetteur ; seule la signature JWKS protégeait encore. Dans le realm commun, le suffixe aurait perdu tout sens.
- **Détection** : lot L4 de la fédération, en relisant les quatre `oidc.py` côte à côte.
- **Cause racine** : l'émetteur vu du navigateur diffère de celui vu du réseau Docker. Chaque module a contourné l'écart localement, faute d'un moyen de déclarer plusieurs émetteurs exacts. Dans needs, le défaut d'`OIDC_ISSUER` ignorait aussi `NEEDS_PORT`, que Keycloak utilise.
- **Correctif** : `core/auth/jwt_verifier.py`, une seule implémentation copiée à l'identique dans chaque module. Elle compare l'émetteur exactement à la table `OIDC_TRUSTED_ISSUERS` (émetteur vers JWKS), plus le couple historique ; elle accepte une liste d'audiences, RS256 seul ; un refus produit un journal `info`, jamais de `print`. Le défaut d'`OIDC_ISSUER` de needs suit désormais `NEEDS_PORT`.
- **Prévention** : `test_jwt_verifier.py` (21 cas, dont émetteur voisin, même realm sur un autre hôte, alg none, HS256, audience, expiration). La mutation « suffixe » et la mutation « audience non vérifiée » échouent. Le job CI `auth-commune` refuse toute copie divergente.
- **Leçon généralisée** : un écart d'environnement (hôte, port) se déclare dans la configuration ; il ne s'absorbe pas en élargissant un contrôle de sécurité.
- **Catégorie** : Sécurité / authentification
- **Récidive** : non

### 2026-10-28 — Les policies needs supposaient un realm réservé au module (fédération Cerbos)
- **Contexte / symptôme** : fusion des policies needs et comptes rendus dans le bundle commun `cerbos/`. La lecture des campagnes était ouverte par `roles: ["*"]`, et les verrous `validate` / `reopen` / envoi étaient des DENY par liste de rôles.
- **Impact** : near miss, vu avant la bascule. Dans le realm commun `cfao`, apprenants, candidats et partenaires B2B auraient lu les campagnes. Un directeur du centre aussi directeur de filiale aurait perdu la validation (le DENY l'emporte).
- **Détection** : étude d'architecture de la fédération, avant toute migration.
- **Cause racine** : une policy écrite pour un realm où seuls les collaborateurs ont un compte, sans hypothèse écrite ni test hors de ce périmètre.
- **Correctif** : derived role `internal_staff` (liste explicite, `derived_roles/staff.yaml`) ; DENY porté par `outside_academy`, qui exclut les porteurs d'un rôle Academy (`derived_roles/needs_review.yaml`).
- **Prévention** : tests « comptes externes » et « rôles cumulés » dans `cerbos/tests/needs/`. Sur les anciennes policies, ils échouent (10 échecs, mutation rejouée) ; garde CI « aucun bundle Cerbos de module ».
- **Leçon généralisée** : une règle d'autorisation dépend de la population des comptes. Quand la population change (fusion de realms), chaque joker et chaque DENY par rôle est relu et testé avec des comptes externes et des rôles cumulés.
- **Catégorie** : Sécurité / autorisation
- **Récidive** : non

### 2026-10-28 — Le comparateur du dry-run clé fusionnait deux lignes de pied (cfao-planning)
- **Contexte / symptôme** : comparaison calcul / classeur des pieds des feuilles pays. Les libellés étaient tronqués à 14 caractères : « FRAIS D'ACCOMO… » techniciens et formateurs devenaient une seule clé.
- **Impact** : l'hébergement formateurs écrasait l'hébergement techniciens. Un faux écart était affiché, et un vrai écart pouvait être masqué. Near miss : vu avant toute conclusion métier.
- **Détection** : un écart incohérent (hébergement techniciens égal à l'hébergement formateurs) sur plusieurs pays.
- **Cause racine** : une clé de dictionnaire dérivée d'un libellé tronqué, donc non unique.
- **Correctif** : libellés complets comme clés (script scratch `dry_seats.py`).
- **Prévention** : l'importeur ne dépend pas des libellés de pied : il ne lit que la ligne « TOTAL », couverte par `test_import_seat_sheets.py` (`TOTAL_MISMATCH`).
- **Leçon généralisée** : un outil de vérification est du code, et il peut mentir. Une clé construite par troncature doit être prouvée unique, sinon il faut garder la valeur entière.
- **Catégorie** : Données / vérification
### 2026-10-29 — Tables d'arbitrage needs adoptées par Django (cfao-needs) — suite de « tables inexistantes » ci-dessous
- **Contexte / symptôme** : décision métier « A » (créer les tables). Leur schéma existait déjà dans `scripts/ingestion/init_database_tables.sql`, appliqué par `docker exec` hors des migrations. Deux near misses pendant le correctif. D'abord, un `RunPython` placé dans `SeparateDatabaseAndState(database_operations=...)` reçoit l'état *antérieur* aux modèles qu'il doit créer. Ensuite, SQLite (base de test) ne replie pas la casse des lettres accentuées (`PLACÉES` contre `Placées`), alors que Postgres le fait.
- **Impact** : aucun (corrigés avant exécution pour le premier, au premier run pour le second).
- **Détection** : relecture de la migration ; test `test_allocations_sum_by_country_without_summary_rows`, rouge sur SQLite.
- **Cause racine** : une table créée par un script de chargement n'avait ni modèle ni migration. Les vues la lisaient donc en SQL brut, propre à Postgres (`ILIKE`), intestable sur la base de test.
- **Correctif** : modèles `BranchBrandQuota`, `CourseAllocation`, `TrainingSession` (schéma identique au SQL) ; migration `0004` : état seul, puis `RunPython` qui crée les tables absentes et adopte celles du script ; vues réécrites en ORM ; xfail retiré.
- **Prévention** : tests des trois agrégats sur données réelles ; test d'adoption ; suite rejouée sur Postgres 16, y compris l'ordre « script puis `migrate` », le SQL relancé après `migrate` et l'aller-retour de migration.
- **Leçon généralisée** : un script de chargement alimente des tables, il ne les possède pas. L'opération qui crée une table doit voir l'état qui la déclare. Un test sur SQLite ne prouve pas un comportement de collation Postgres.
- **Catégorie** : modèle de données
- **Récidive** : non

### 2026-10-29 — Labels de contrat posés à la main dans les Dockerfiles (contracts)
- **Contexte / symptôme** : première version du registre. Les labels `org.cfao.*` ont été ajoutés aux trois Dockerfiles par un script d'édition qui a écrit des `\n` littéraux au lieu de sauts de ligne. Le contrôle de `check.py` les a acceptés, car son parseur lisait l'instruction `LABEL` sur une seule ligne. Ensuite, un format de spec inconnu dans le registre faisait planter le calcul des labels au lieu d'être signalé.
- **Impact** : aucun (near miss, corrigé avant commit pour les `\n`, avant push pour le format). Un Dockerfile mal formé aurait cassé le build de l'image.
- **Détection** : relecture des octets des Dockerfiles ; test `test_unknown_format_is_refused` (rouge, `KeyError`).
- **Cause racine** : les labels étaient écrits à la main et vérifiés par un parseur plus tolérant que Docker. Aucune source unique ne les produisait, et le calcul des labels supposait un registre valide.
- **Correctif** : `contracts/sync.py` génère un bloc délimité, après le dernier `FROM`, et ne réécrit que ce bloc s'il dérive. Un label de l'espace de noms hors du bloc est un conflit signalé, jamais modifié. `kit.expected_labels` ignore les entrées invalides, que `check.py` signale.
- **Prévention** : `sync.py --check` en CI ; tests de convergence (second passage sans écriture), de conflit, de CRLF, de format inconnu ; images vérifiées par `docker image inspect` après build.
- **Leçon généralisée** : ce qui se déduit d'une source se génère, ne se recopie pas. Un contrôle qui parse plus largement que l'outil réel laisse passer des fichiers que l'outil refusera.
- **Catégorie** : contrat inter-modules
- **Récidive** : non

### 2026-10-29 — Les agrégats needs lus par core interrogent des tables inexistantes (cfao-needs, cfao-core)
- **Contexte / symptôme** : premier test fournisseur du contrat `needs-analytics`. Les trois routes `/api/v1/needs/analytics/*` lèvent `no such table` dès que la clé est valide.
- **Impact** : le tableau de bord super admin de core afficherait 0 techniciens, 0 sessions et aucune allocation, sans erreur visible (core renvoie 0 ou `[]` sur toute réponse non 200 et ne journalise qu'un warning). Pas d'impact constaté : core n'est pas déployé sur le serveur.
- **Détection** : `cfao-needs/api/analytics/tests/test_contract.py` ; vérifié en lecture seule sur la base de production de needs (tables absentes).
- **Cause racine** : les vues lisent en SQL brut `campaigns_branchbrandquota`, `campaigns_courseallocation` et `campaigns_trainingsession`, qu'aucun modèle ni migration ne crée. Aucune frontière inter-modules n'était testée, et le repli silencieux de core masquait l'erreur. Deux autres écarts avec la docstring : refus de clé en 403 (et non 401) avec l'enveloppe `{"error": ...}`.
- **Correctif** : contrat publié selon le comportement réel (403, deux formats d'erreur). Le cas 200 est marqué `xfail(strict=True)` jusqu'à la réécriture des requêtes sur les modèles réels, qui demande une décision métier sur la source des effectifs et des allocations.
- **Prévention** : registre `contracts/`, test fournisseur contre le serveur, test consommateur dans core, job CI `contracts`, `can_i_deploy.py` avant tout déploiement.
- **Leçon généralisée** : une intégration qui se replie en silence doit être couverte par un test de contrat des deux côtés, sinon sa panne ressemble à une donnée nulle.
- **Catégorie** : contrat inter-modules
- **Récidive** : non

### 2026-10-29 — Connexion refusée en prod après la v0.4.0, `ORIGINES_AUTORISEES` absente (cfao-comptes-rendus)
- **Contexte / symptôme** : après le passage en v0.4.0, plus personne ne se connecte aux comptes rendus. Le navigateur affiche « forbidden », l'API répond 403 `origine non autorisee` à tous les POST.
- **Impact** : module inutilisable (connexion, aperçu, enregistrement) pour tous les utilisateurs.
- **Détection** : signalement d'un formateur ; journaux de la passerelle (403 et non 401).
- **Cause racine** : la v0.4.0 ajoute le contrôle d'origine `ControleOrigine`. Le `.env` du serveur n'a pas reçu `ORIGINES_AUTORISEES` ; la valeur par défaut ne liste que `localhost`. Le guide de mise à jour ne citait pas la variable et le contrôle après déploiement n'essayait pas de connexion depuis l'adresse réelle.
- **Correctif** : `ORIGINES_AUTORISEES=http://192.168.10.155:8092` ajoutée au `.env` du serveur, API recréée. Vérifié : origine du serveur 401 sur faux identifiants, origine étrangère 403.
- **Prévention** : `MISE_A_JOUR.md` liste la variable à l'étape 4 et le contrôle de l'étape 6 envoie un POST de connexion avec l'en-tête `Origin` réel (401 attendu, jamais 403).
- **Leçon généralisée** : toute nouvelle variable obligatoire en prod doit apparaître dans le guide de mise à jour, et le contrôle post-déploiement doit passer par l'adresse réelle des utilisateurs, pas par `localhost`.
- **Catégorie** : déploiement
- **Récidive** : non

### 2026-10-28 — Le filtre de chemins échouait sur GitHub faute de droit de lecture des PR (cfao-academy-mail)
- **Contexte / symptôme** : premières PR (#21 hub mail, #22 contrôle `frontend/` seul). Le job `Chemins touchés` échoue sur les deux avec `Resource not accessible by integration`. Le job `mail` est alors `skipping` partout, y compris quand le hub change.
- **Impact** : les tests du hub ne tournaient jamais en PR. Le test de fichier était vert.
- **Détection** : exécution réelle sur GitHub, comme prévu par l'[entrée du 2026-10-27](#2026-10-27--le-filtre-ci-du-hub-na-pas-été-observé-sur-github-cfao-academy-mail).
- **Cause racine** : `dorny/paths-filter` lit les fichiers d'une PR via l'API. Le workflow n'accorde que `contents: read` au niveau global.
- **Correctif** : `permissions: contents: read, pull-requests: read` sur le job `changes` (commit `43ada54`). Après correctif : `mail` pass sur #21, skipping sur #22.
- **Prévention** : `test_mail_ci_job_is_path_filtered` vérifie `pull-requests: read` dans le bloc `changes` (vu rouge sans la ligne). Résultats collés dans le walkthrough 15.
- **Leçon généralisée** : une condition `if` qui dépend d'un job amont transforme l'échec de ce job en silence. Un job sauté n'est pas un job vert : vérifier la cause d'un `skipping` inattendu.
- **Catégorie** : CI/CD
- **Récidive** : non (suite directe de l'entrée du 27/10, qui laissait ce risque ouvert)

### 2026-10-27 — Un message console est passé à SENT par qcluster (cfao-academy-mail)
- **Contexte / symptôme** : suite de l'entrée du 22/10 et de celle du matin (worker déclaré, image Python injoignable via le proxy Docker Desktop). L'image `python:3.12-slim` a été téléchargée depuis Windows, empreinte de chaque fichier vérifiée, puis chargée avec `docker load`. Les trois services sont `healthy`. Un enqueue `rapports.cr_steps_missing` (`MAIL_EMAIL_BACKEND=console`, `correlation_id` `rapports:smoke-20261027:steps`) répond `APPROVED`, puis la base passe à `SENT`.
- **Impact** : le chemin asynchrone du hub est prouvé pour un message. Le proxy Docker Desktop reste en panne : un `docker pull` normal échouera encore.
- **Détection** : `docker compose ps`, logs `mail-worker` (`Q Cluster ... [mail] running`, puis `[mail] to=...` et `Processed 'outbound.tasks.dispatch_message'`), `SELECT status` sur `outbound_outboundmessage`.
- **Cause racine** : le matin, le registre était injoignable (`TLS handshake timeout` vers `auth.docker.io`). Le contournement ne change pas ce proxy. Il fournit l'image de base déjà contrôlée, ce qui permet au consommateur déclaré de tourner.
- **Correctif** : aucun changement de code. Smoke exécuté et collé dans `walkthrough/15-cfao-academy-mail-amorcage.md`.
- **Prévention** : la sortie `SENT` est dans le walkthrough. Pour une autre image, le script `scripts/pull-image.ps1` (téléchargement, empreinte, `docker load`) est le contournement connu. Le healthcheck `os.kill(1, 0)` ne remplace pas ce smoke.
- **Leçon généralisée** : un service `healthy` ne prouve pas qu'une tâche a été consommée. La preuve est le passage du message à `SENT`.
- **Catégorie** : release/déploiement
- **Récidive** : oui (entrées du 2026-10-22 et « Worker mail déclaré, démarrage Docker non observé »). Le contrôle renforcé est le smoke réel, maintenant exécuté.

### 2026-10-27 — Le filtre CI du hub n'a pas été observé sur GitHub (cfao-academy-mail)
- **Contexte / symptôme** : le job `mail` partait à chaque push. Le workflow déclare maintenant `dorny/paths-filter@v3`, un job `changes`, et `mail` seulement si `needs.changes.outputs.mail == 'true'`, ou si l'événement est `workflow_dispatch` ou `workflow_call`. Aucune PR frontend seule et aucune PR mail n'ont été poussées.
- **Impact** : le texte du workflow peut être faux au runtime GitHub (syntaxe `if`, sortie du filtre) sans que le dépôt le voie.
- **Détection** : brief du 22/10, point 9. Décision de ne pas pousser ni ouvrir de PR sans accord.
- **Cause racine** : un job sans filtre de chemins traite tout le dépôt comme une seule surface.
- **Correctif** : `.github/workflows/ci.yml`, job `changes` et condition du job `mail`. Les filtres des autres jobs n'ont pas été modifiés.
- **Prévention** : `test_mail_ci_job_is_path_filtered` vérifie la présence du filtre, des chemins `cfao-academy-mail/**` et `.github/workflows/ci.yml`, et des trois déclencheurs. Ce test lit le fichier. Il ne prouve pas le skip ni le run GitHub. Ces deux résultats restent à coller dans le walkthrough.
- **Leçon généralisée** : le rayon d'exécution de la CI suit le rayon d'impact. Le filtre est du code, et sa preuve complète est une exécution sur la forge.
- **Catégorie** : CI/CD
- **Récidive** : non

### 2026-10-27 — Le walkthrough du hub annonçait une suite périmée (cfao-academy-mail)
- **Contexte / symptôme** : `walkthrough/README.md` affichait « pytest 5/5 » et la fiche 15 disait que `qcluster` n'était pas dans Compose, alors que la suite avait déjà grandi et que le worker a été ajouté ensuite.
- **Impact** : une lecture du journal conclut que le déploiement est couvert, ou l'inverse, sans rapport avec les commandes réellement lancées.
- **Détection** : brief du 22/10, point 8.
- **Cause racine** : le journal a été figé le jour de l'amorçage et n'a pas suivi les commandes suivantes.
- **Correctif** : fiche `walkthrough/15-cfao-academy-mail-amorcage.md` et la ligne du README, avec les sorties du 27/10 et la liste de ce qui n'a pas tourné.
- **Prévention** : ne rien marquer fait sans la sortie de la commande. Les trous (Docker, GitHub, `make` absent) sont écrits comme non couverts, pas comme réussis.
- **Leçon généralisée** : un chiffre de tests dans un journal est une observation datée. Il se remplace par une nouvelle observation, il ne se déduit pas du nombre de fonctions `test_` présentes dans le code.
- **Catégorie** : process
- **Récidive** : non

### 2026-10-27 — Idempotence mail garantie seulement par une lecture puis une écriture (cfao-academy-mail)
- **Contexte / symptôme** : deux `create()` concurrents avec le même `correlation_id` pouvaient insérer deux messages. Le code faisait `filter().first()` avant `create()`, sans contrainte.
- **Impact** : un producteur qui retente un enqueue peut envoyer deux fois le même courrier.
- **Détection** : brief du 22/10, point 7.
- **Cause racine** : l'unicité était décidée dans le processus, pas dans la base.
- **Correctif** : `UniqueConstraint` `uniq_mail_correlation_active` (migration `0002_uniq_correlation_active`) sur `correlation_id` non nul et statut différent de `REJECTED`. `IntegrityError` à la création renvoie la ligne déjà active (200).
- **Prévention** : `test_active_correlation_id_is_unique` provoque l'intégrité en base. Le filtre préalable reste un raccourci, pas la garantie.
- **Leçon généralisée** : l'idempotence se garantit par une contrainte, jamais par une lecture suivie d'une écriture.
- **Catégorie** : données
- **Récidive** : non

### 2026-10-27 — `make test-mail` ne part pas sur ce poste (cfao-academy-mail)
- **Contexte / symptôme** : sans `MAIL_SECRET_KEY`, l'import de `base.py` plantait avant que `test.py` ne pose la clé. `make test-mail` installait aussi les dépendances dans l'interpréteur courant. Le 27/10, `MAIL_SECRET_KEY` est absent et pytest via `api/.venv` donne `25 passed in 16.07s`. La commande `make test-mail` elle-même répond `CommandNotFoundException` : aucun `make.exe` (Git, MSYS2, Scoop, GnuWin32).
- **Impact** : la commande documentée n'est pas celle qui a produit la preuve. Un clone sur un poste sans GNU Make reste non prouvé par `make`.
- **Détection** : brief du 22/10, point 6, puis lancement le 27/10.
- **Cause racine** : la suite n'était verte que dans un environnement déjà préparé (variable CI, interpréteur du moment). Le binaire `make` n'a pas été vérifié sur la machine qui devait lancer la cible.
- **Correctif** : `os.environ.setdefault("MAIL_SECRET_KEY", "test-secret-key")` dans `test.py` avant `from .base import *`. Pas de défaut dans `base.py`. Les cibles `test` et `test-mail` créent `api/.venv` et appellent `.venv/Scripts/python.exe`.
- **Prévention** : pytest du 27/10 lancé avec `MAIL_SECRET_KEY set: False`. Tant que `make` est absent du PATH, le walkthrough ne doit pas écrire que `make test-mail` est vert.
- **Leçon généralisée** : « les tests passent » se prouve avec la commande documentée, sur une machine où cette commande existe.
- **Catégorie** : tests
- **Récidive** : non

### 2026-10-27 — Le serveur mail acceptait ce que le contrat OpenAPI refuse (cfao-academy-mail)
- **Contexte / symptôme** : `locale = "de"` répondait 201, puis le rendu levait `MissingTranslation`. Un champ inconnu était ignoré par DRF alors que le schéma publié a `additionalProperties: false`.
- **Impact** : l'appelant croit le courrier parti. Le fichier OpenAPI et le serveur ne décrivent pas la même API.
- **Détection** : brief du 22/10, point 5, reproduit par le test de contrat.
- **Cause racine** : le contrat était comparé au catalogue qui le génère, pas aux réponses HTTP.
- **Correctif** : `locale` est un `ChoiceField` `fr` / `en`. `to_internal_value` refuse les clés inconnues. Les erreurs 400 sont renvoyées sous `{"detail": ...}`, forme du schéma `Error`.
- **Prévention** : `test_server_matches_published_contract` valide un corps avec `jsonschema` (Draft 2020-12) et compare au code HTTP. Les `$ref` `#/components/schemas/...` sont réécrits sur tout le document regroupé, y compris ceux imbriqués dans `$defs`.
- **Leçon généralisée** : un contrat publié se teste contre le serveur.
- **Catégorie** : tests
- **Récidive** : non

### 2026-10-27 — L'enqueue mail était routé sur le port public (cfao-academy-mail)
- **Contexte / symptôme** : `gateway/nginx.conf` envoyait tout `/api/v1/mail/` vers le hub, donc `POST /messages/enqueue` aussi. La clé `X-Mail-Service-Key` était la seule barrière, sur le port 8000.
- **Impact** : quiconque atteint le gateway peut tenter d'émettre au nom de `helpdeskcm@cfao.com`.
- **Détection** : brief du 22/10, point 4.
- **Cause racine** : le préfixe du module a été publié en bloc, sans client externe identifié pour l'envoi.
- **Correctif** : `location =` pour `GET /api/v1/mail/healthz` et `/contract` (proxy par variable, résolu à la requête). `location /api/v1/mail/messages/` renvoie 403 JSON et ne contient pas `proxy_pass`. Les producteurs appellent `http://mail-api:5180` sur le réseau `cfao-academy-mail_default`. Le gateway de la plateforme déclare ce réseau en `external`.
- **Prévention** : `test_gateway_does_not_publish_enqueue` relit `gateway/nginx.conf`. Le conteneur gateway n'a pas été démarré le 27/10 : le test prouve le fichier, pas une réponse HTTP live.
- **Leçon généralisée** : une route n'est publiée que si un client externe identifié en a besoin. Une clé ne justifie pas l'exposition.
- **Catégorie** : sécurité
- **Récidive** : non

### 2026-10-27 — `context.reply_to` acceptait n'importe quelle chaîne (cfao-academy-mail)
- **Contexte / symptôme** : `context.reply_to = "pas-un-email"` était stocké dans l'en-tête. Une valeur avec retour à la ligne passait aussi.
- **Impact** : en-tête SMTP falsifiable, ou courrier rejeté plus tard par le relais après un 201.
- **Détection** : brief du 22/10, point 3.
- **Cause racine** : même écart que pour `module_url` : le champ de premier niveau était validé, le chemin `context` ne l'était pas.
- **Correctif** : `validate_reply_to` dans `services/queue.py` (`validate_email`, rejet CR, LF et NUL) avant création du message.
- **Prévention** : `test_context_reply_to_is_rejected` (adresse invalide et adresse avec retour à la ligne) attend 400.
- **Leçon généralisée** : une donnée qui arrive par plusieurs chemins se valide au point de convergence.
- **Catégorie** : sécurité
- **Récidive** : non

### 2026-10-27 — Liste blanche des liens inactive par défaut (cfao-academy-mail)
- **Contexte / symptôme** : `MAIL_ALLOWED_LINK_HOSTS` vide dans `.env.example` signifiait « pas de filtre d'hôte ». Un déploiement copié de l'exemple acceptait n'importe quel lien `https`.
- **Impact** : near miss. Un producteur compromis ou mal configuré pouvait faire signer un lien tiers par `helpdeskcm@cfao.com`.
- **Détection** : relecture du correctif du point 2.
- **Cause racine** : le garde-fou était fail-open : sa valeur par défaut le désactivait.
- **Correctif** : `validate_module_url` refuse tout lien hors DEBUG quand la liste est vide. `.env.example` donne `academy.cfao.com`, `test.py` déclare les hôtes de test.
- **Prévention** : `test_empty_allowlist_rejects_links_outside_debug` (vu rouge sans le correctif). Le test de course `test_concurrent_correlation_id_returns_existing` couvre aussi le rattrapage `IntegrityError` → 200.
- **Leçon généralisée** : un garde-fou de sécurité dont la valeur vide le désactive est fail-open. Vide doit vouloir dire « rien d'autorisé ».
- **Catégorie** : sécurité
- **Récidive** : non

### 2026-10-27 — `context.module_url` pouvait devenir le href du bouton (cfao-academy-mail)
- **Contexte / symptôme** : `context.module_url = "javascript:alert(1)"` répondait 201 et finissait dans le lien. Le champ de premier niveau passait par `URLField`, pas la valeur reprise dans `queue.py`.
- **Impact** : le hub signe au nom de `helpdeskcm@cfao.com`. Un lien `javascript:`, `data:`, `http` hors DEBUG, ou un hôte hors liste, part dans un courrier de la marque.
- **Détection** : brief du 22/10, point 2.
- **Cause racine** : la validation était sur un seul des deux chemins d'arrivée.
- **Correctif** : `validate_module_url` dans `services/queue.py`. Schémas `https`, et `http` seulement si `DEBUG`. Liste `MAIL_ALLOWED_LINK_HOSTS` : vide signifie pas de filtre d'hôte. Sinon l'hôte doit y figurer. Échec → `ForbiddenSend` → 400, aucune ligne.
- **Prévention** : `test_context_module_url_is_rejected` (`javascript:`, `data:`, `http://`), `test_module_url_host_must_be_allowlisted`, `test_https_module_url_is_accepted`.
- **Leçon généralisée** : valider au point de convergence, pas seulement dans le sérialiseur d'un des chemins.
- **Catégorie** : sécurité
- **Récidive** : non

### 2026-10-27 — Worker mail déclaré, démarrage Docker non observé (cfao-academy-mail)
- **Contexte / symptôme** : suite de l'entrée du 2026-10-22. `docker-compose.yml` contient `mail-worker` (`python manage.py qcluster`, `depends_on` mail-db et mail-api sains, mémoire 384 Mio, healthcheck `os.kill(1, 0)`). `qmonitor --run-once` n'est pas utilisé : sous django-q2, `qmonitor` reste une boucle. Le 27/10, `docker compose up -d --build` et `docker pull python:3.12-slim` échouent avant le build.
- **Impact** : en déploiement, un 201 peut encore laisser le message en `APPROVED` si le worker n'a jamais tourné. Les tests restent verts grâce à `Q_CLUSTER.sync = True`. On ne peut pas coller un log `SENT` du worker.
- **Détection** : deux `docker compose up -d --build` et un `docker pull`. Erreur : `Post "https://auth.docker.io/token": net/http: TLS handshake timeout`. Pas de proxy HTTP. Image `python:3.12-slim` absente du cache local (seuls `postgres:16-alpine` et `postgres:15-alpine` sont présents).
- **Cause racine** : le bug d'origine est le mode synchrone des tests, qui ne lance pas `qcluster`. Le trou restant au 27/10 est l'accès registry : le processus est déclaré, il n'a pas été vu démarrer.
- **Correctif** : service `mail-worker` dans `cfao-academy-mail/docker-compose.yml`. `.env` local (non versionné) a `MAIL_EMAIL_BACKEND=console` pour le smoke, qui n'a pas eu lieu.
- **Prévention** : le smoke attendu reste `make up`, un enqueue, puis `SENT` dans les logs du worker, collé dans le walkthrough. Il n'est pas vert. Pytest ne le remplace pas.
- **Leçon généralisée** : un service écrit dans Compose n'est pas une preuve qu'il a démarré. La sortie de la commande fait partie du correctif.
- **Catégorie** : release/déploiement
- **Récidive** : oui ([entrée du 2026-10-22](#2026-10-22--aucun-consommateur-pour-la-file-django-q-cfao-academy-mail)). Le consommateur est déclaré. Le contrôle renforcé (smoke réel) n'a pas pu s'exécuter.

### 2026-10-22 — Aucun consommateur pour la file django-q (cfao-academy-mail)
- **Contexte / symptôme** : les mails sont mis en file (`async_task`), mais aucun worker `qcluster` n'est lancé. En Docker, l'API répond 201 et le message reste `APPROVED`.
- **Impact** : aucun mail ne part en déploiement, alors que la suite de tests est verte.
- **Détection** : relecture du 22/10 ; la recherche de `qcluster` dans tout le module ne donne aucun résultat.
- **Cause racine** : les tests tournent avec `Q_CLUSTER["sync"] = True`, donc le chemin asynchrone n'a jamais été exercé. Le déploiement n'a jamais été démarré pour de vrai.
- **Correctif** : brief de correctifs, point 1.
- **Prévention** : service `mail-worker` dans `docker-compose.yml`, et smoke test dont la sortie est collée dans le walkthrough.
- **Leçon généralisée** : un mode synchrone en test ne couvre pas un chemin asynchrone de prod. Chaque processus (API, worker, cron) doit être déclaré et démarré au moins une fois.
- **Catégorie** : release/déploiement
- **Récidive** : non
