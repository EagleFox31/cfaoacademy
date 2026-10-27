# 15 — CFAO Academy Mail · amorçage du hub inter-modules

## Contexte

Besoin métier : **needs**, **comptes-rendus**, **core** et **operations** doivent envoyer des emails
(transactionnels formateurs, campagnes needs avec relecture, rappels LMS/ops) via **un seul relais**,
sans dupliquer SMTP/templates dans chaque service.

Décision de session : créer le déployable **`cfao-academy-mail/`** en généralisant le modèle
`cfao-needs/api/outbound/` (templates versionnés, file, journal, backends abstraits).

Relecture du 22/10/2026 (`cfao-academy-mail/BRIEF_CORRECTIFS.md`) appliquée le **27/10/2026**.
Les chiffres du 20/10 restent l'historique. Ils ne décrivent plus l'état du dépôt.

## Réalisation

| Élément | Détail |
|---------|--------|
| **Quand** | Amorçage **20 octobre 2026**. Correctifs brief **27 octobre 2026**. |
| **Comment** | Django 5 + DRF, app `outbound`, catalogue namespacé, `POST /api/v1/mail/messages/enqueue` protégé par `X-Mail-Service-Key`, worker `mail-worker` (`qcluster`) déclaré dans `cfao-academy-mail/docker-compose.yml`. Gateway : healthz et contrat seulement. Job CI `mail` filtré par `dorny/paths-filter@v3`. |

## État au 20 octobre 2026

- Emails **needs** : implémentation dans `cfao-needs/api/outbound/`.
- Aucun service **`cfao-academy-mail`** avant cette session.
- pytest d'amorçage, interpréteur `cfao-needs/api/.venv`, `Q_CLUSTER.sync = True`, backend `locmem` :

```text
5 passed in 2.33s
```

Ce chiffre ne couvrait que `test_enqueue.py` à cette date. Il est périmé.

## Tests exécutés le 27 octobre 2026

Interpréteur : `cfao-academy-mail/api/.venv` (Python 3.12). `MAIL_SECRET_KEY` absent du shell.
Settings de test : `config.settings.test` pose la clé de test avant l'import de `base`, SQLite mémoire,
backend `locmem`, `Q_CLUSTER.sync = True`.

```text
MAIL_SECRET_KEY set: False
.........................                                                [100%]
25 passed in 16.07s
```

Un passage précédent, après correction des `$ref` jsonschema, avait donné `25 passed in 1.79s`.

Après la relecture (liste blanche fail-closed, test de course sur `correlation_id`), même shell sans variable :

```text
...........................                                              [100%]
27 passed in 1.23s
```

Les deux nouveaux tests ont été vus rouges en retirant temporairement le correctif correspondant, puis verts une fois le correctif remis.

| Test | Ce qu'il prouve |
|------|-----------------|
| `test_enqueue.py` (7) | enqueue rapports → `SENT` en sync, clé obligatoire, needs en relecture, kind inconnu, `reply_to` et URL du bouton fournis par l'appelant, healthz |
| `test_layout.py` (4) | shell, phrase de formation, `lang`, lignes quoted-printable d'au plus 76 caractères |
| `test_security.py` | `javascript:`, `data:`, `http://` et hôte hors `MAIL_ALLOWED_LINK_HOSTS` → 400 ; liste vide hors DEBUG → 400 ; `https` accepté ; `reply_to` invalide ou avec retour à la ligne → 400 ; deuxième insert du même `correlation_id` actif → `IntegrityError` ; course (lecture préalable aveugle) → 200 avec le message existant, une seule ligne |
| `test_contract.py` (4) | fichier OpenAPI égal au catalogue ; endpoint contrat ; compte rendu incomplet → 400 sans envoi ; requêtes valides et invalides comparées au schéma Draft 2020-12 et au code HTTP |
| `test_deploy_guards.py` (2) | `gateway/nginx.conf` ne proxy pas `messages/` ; `ci.yml` contient le filtre de chemins et les déclencheurs manuels |

`make test-mail` n'a pas été exécuté : `make` n'est pas dans le PATH (`CommandNotFoundException`).
La recette pytest du venv, elle, a tourné. `pip install -q -r requirements-dev.txt` a été lancé
et arrêté sans sortie. La preuve ci-dessus ne réinstalle pas les paquets.

## Smoke Docker (point 1 du brief)

Le matin, `docker compose up -d --build` et `docker pull python:3.12-slim` échouaient :
`Post "https://auth.docker.io/token": net/http: TLS handshake timeout`.
Le proxy de Docker Desktop est toujours en panne : un `docker pull` lancé normalement échouera encore.
L'image `python:3.12-slim` a été téléchargée depuis Windows, empreinte de chaque fichier vérifiée, puis chargée avec `docker load`.
Script réutilisable pour une autre image :
`.\scripts\pull-image.ps1 -Repo library/<nom> -Tag <tag> -Out <dossier vide>` (archive et `docker load` inclus).

`.env` local (non versionné) : `MAIL_EMAIL_BACKEND=console`.

`docker compose ps` :

```text
NAME                              STATUS                        SERVICE
cfao-academy-mail-mail-api-1      Up About a minute (healthy)   mail-api
cfao-academy-mail-mail-db-1       Up About a minute (healthy)   mail-db
cfao-academy-mail-mail-worker-1   Up About a minute (healthy)   mail-worker
```

`docker compose exec -T mail-api python manage.py seed_email_templates` → `Templates créés : 18`.

Enqueue `POST http://127.0.0.1:5180/api/v1/mail/messages/enqueue`, clé `X-Mail-Service-Key`,
`correlation_id` `rapports:smoke-20261027:steps`, kind `rapports.cr_steps_missing`.
Réponse : `created: true`, statut au moment de la réponse `APPROVED`, id `843e6970-98aa-46a0-86cf-5de7e69671f0`.

Postgres (`outbound_outboundmessage`) :

```text
 status |           kind
--------+---------------------------
 SENT   | rapports.cr_steps_missing
(1 row)
```

Logs `mail-worker` :

```text
09:04:05 [Q] INFO Q Cluster mars-blossom-summer-happy starting.
09:04:06 [Q] INFO Process-fa5ea93d35f345d881b3fc24a0879283 ready for work at 8
09:04:06 [Q] INFO Process-a4e8ee8b07ed4196b7c7bcbead224332 ready for work at 9
09:04:06 [Q] INFO Process-503e11e43ba04e74999b45560d6659b7 guarding cluster mars-blossom-summer-happy [mail]
09:04:06 [Q] INFO Process-a81c5b9c658344c8ba41c9d9087fd6ab pushing tasks at 11
09:04:06 [Q] INFO Process-b30c38e3bd7d4e9e9d06ab551673ad7b monitoring at 10
09:04:06 [Q] INFO Q Cluster mars-blossom-summer-happy [mail] running.
09:07:22 [Q] INFO Process-fa5ea93d35f345d881b3fc24a0879283 processing alabama-tennessee-lima-missouri 'outbound.tasks.dispatch_message'
[mail] to=['formateur@filiale.example.com'] cc=[] reply_to=-
  [CFAO Academy] Pages manquantes — TS04-G3
Bonjour Jean Dupont,

Il reste à compléter Resultats, Photos sur le compte rendu de la formation TOYOTA TS04-G3, niveau G3, Revision des organes chassis, du 19 au 23 janvier 2026, au Togo.

https://academy.example/portail/compte-rendu

09:07:24 [Q] INFO Processed 'outbound.tasks.dispatch_message' (alabama-tennessee-lima-missouri)
```

Après reconstruction avec la liste blanche (`.env` local : `MAIL_ALLOWED_LINK_HOSTS=academy.example`) :
un lien `https://academy.example/...` → 201 puis `SENT` ; le même envoi vers `https://evil.example/...` → 400.

Le healthcheck du worker reste `os.kill(1, 0)`. La preuve de consommation est le passage à `SENT` et la ligne `[mail]` ci-dessus, pas le healthcheck.

## Point 9 — filtre CI, non observé sur GitHub

Aucune PR n'a été poussée. On n'a donc pas vu un job `mail` skipped sur un diff `frontend/`
ni un job `mail` lancé sur un diff `cfao-academy-mail/`.
Le seul contrôle exécuté est `test_mail_ci_job_is_path_filtered`, qui lit `.github/workflows/ci.yml`.

## Périmètre couvert au 27 octobre 2026

- Catalogue, enqueue, rendu, clé service en temps constant, clé vide fail-closed, HTML échappé.
- `module_url` et `reply_to` validés dans `queue.py`, quel que soit le chemin d'arrivée. Hors DEBUG, `MAIL_ALLOWED_LINK_HOSTS` vide refuse tout lien (default-deny).
- `locale` limitée à `fr` et `en`. Champ inconnu → 400 `{"detail": ...}`.
- Contrainte d'unicité `uniq_mail_correlation_active` (migration `0002`).
- Gateway : `location = /api/v1/mail/healthz`, `location = /api/v1/mail/contract`, `messages/` en 403 sans `proxy_pass`. Fichier testé, conteneur non démarré.
- Réseau Compose racine : `cfao-academy-mail` est `external`, nom `cfao-academy-mail_default`. Démarrer la plateforme avant le compose du hub échoue à la résolution de ce réseau. Non exercé en live.
- Worker Docker : `qcluster` healthy, enqueue console passé de `APPROVED` à `SENT` (logs et base).

## NON couvert

1. `make test-mail` en tant que commande (binaire absent).
2. Skip et run GitHub du job `mail` sur deux PR.
3. Réponse HTTP live du gateway (403 sur `messages/`, healthz et contrat proxifiés).
4. Clients HTTP needs, rapports, core, operations. Pas de Pact. Pas de Playwright. Pas de Cerbos sur cet enqueue (clé service, pas une policy).
5. Deux inserts concurrents réels : le test simule la course (lecture préalable aveugle, puis `IntegrityError` → 200), il ne lance pas deux processus.

## Definition of Done RAIDER

- [ ] **Reusable** — le catalogue vise plusieurs producteurs. Aucun producteur n'appelle le hub.
- [x] **Agnostic** — clé, SMTP, hôtes de liens et backend viennent de l'environnement. `base.py` n'a pas de clé par défaut.
- [x] **Idempotent** — contrainte partielle + `IntegrityError` → ligne existante. Non prouvé avec deux workers Docker.
- [x] **Durable** — 27 tests passés le 27/10, ancienne suite comprise (enqueue, layout, clé, compte rendu incomplet, contrat généré).
- [x] **Failure memory** — entrées du 27/10 dans `docs/engineering/lessons-learned.md`. Échecs de commandes dans `docs/error_logs.md`. L'entrée du 22/10 n'a pas été réécrite.
- [ ] **Engineering-grade** — tests, durcissement et smoke Docker (`APPROVED` puis `SENT`, backend console) sont observés. Le filtre CI sur GitHub ne l'est pas.
- [ ] **Scoped execution** — le `if` du job `mail` est dans le workflow et relu par un test de fichier. Les deux résultats GitHub demandés par le brief ne sont pas collés.
- [x] **Reuse-first** — file django-q2 et modèle outbound repris de needs. Filtre CI : `dorny/paths-filter` (Adopt). Pas de script de filtre maison.
- [x] **Retroactive** — module ajouté à côté des apps existantes, sans reset. Exception : le compose racine exige le réseau externe `cfao-academy-mail_default`.
- [x] Exceptions écrites dans « NON couvert » et dans les cases ouvertes ci-dessus.
