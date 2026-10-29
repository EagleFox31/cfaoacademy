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
| Toute frontière inter-modules est déclarée dans `contracts/registry.json`, avec test fournisseur et test consommateur | D, E (contrats explicites) | job CI `contracts` + tests consommateur de chaque module |
| Un fichier dérivé d'une source (labels, spec publiée) est réconcilié par un outil qui n'écrit que son bloc et seulement s'il dérive | I, R | `contracts/sync.py --check` en CI + test de second passage sans écriture |

## Entrées

<!-- Plus récentes en haut. On n'efface ni ne réécrit une entrée : on corrige par une nouvelle entrée qui la référence. -->

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
