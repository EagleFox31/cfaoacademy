# Plan de durcissement (DevOps et sécurité)

Source : audit en lecture seule du 19/11/2026 (20 constats). Ce plan donne l'ordre, la session responsable, les verrous et la preuve attendue. Règles communes : [docs/engineering/coordination.md](docs/engineering/coordination.md).

**Porteur du plan : la session sentinelle** (décision de l'utilisateur, 19/11). Les colonnes « Session » ci-dessous disent qui touche chaque zone ; sentinelle ordonne, vérifie et réclame les preuves. manitou garde les verrous et les livraisons groupées.

## Règles de ce chantier
- **Un constat = un commit**, avec sa preuve (test ou commande et sortie). Pas de lot de correctifs mélangés.
- **Une livraison par phase**, pas une par constat : file `coord.py release`, une construction par image, depuis un worktree propre au dernier commit.
- **Rien sur le serveur sans accord de l'utilisateur** (verrou `deploy:serveur`). Les secrets de prod se changent sur le serveur, jamais dans le dépôt.
- Un constat est **vérifié sur le disque avant d'être corrigé**. État de la vérification en dernière colonne.

## Phase 0 : aujourd'hui (risque réel, correctif petit)
| # | Action | Session | Fichiers | Preuve | Vérifié |
|---|---|---|---|---|---|
| 1 | Créer `settings/prod.py` pour needs (DEBUG off, hôtes explicites) et l'utiliser en prod | cfao-planning (à confirmer) | cfao-needs/api/config/settings/, cfao-needs/docker-compose.prod.yml:56 | pytest needs avec prod.py ; démarrage prod en recette, DEBUG=False | oui : prod = `config.settings.dev` ; pas de `prod.py` |
| 2 | Supprimer les secrets par défaut (`${X:?}`), puis **changer ces secrets en prod** | cfao-planning, puis l'utilisateur pour le serveur | même compose, l.42, 57, 62 | `docker compose config` échoue sans variable ; recette redémarre avec ses variables | oui : valeurs par défaut présentes aux 3 lignes |
| 2b | Historique git : les anciennes valeurs restent lisibles (dépôt public). La rotation suffit à neutraliser ; **purger l'historique est une décision de l'utilisateur** (réécriture, force-push) | l'utilisateur | | | à décider |
| 16 | Core en prod : passer de `settings.base` à un `prod.py` (SECRET_KEY obligatoire, SECURE_* actifs derrière edge) | cfao-planning (à confirmer) | cfao-core/docker-compose.prod.yml:34, cfao-core/config/settings/ | pytest core ; en-têtes vus via edge | oui : `config.settings.base` en prod |

## Phase 1 : cette semaine
| # | Action | Session | Verrous | Preuve | Vérifié |
|---|---|---|---|---|---|
| 3 | Proxy du socket Docker : relire la ligne complète de `-allowGET` ; retirer `containers/<id>/json` si le collecteur peut s'en passer (il lit l'environnement des conteneurs) | cfaoacademy-cf (zone supervision) | build:cfao-supervision/api | le collecteur fonctionne sans ; `curl` du proxy sur `/containers/<id>/json` refusé | partiel : la règle existe (l.114), sa ligne est tronquée à la lecture |
| 4 | Utilisateur non root (`USER`) dans core, needs, planning ; retirer `build-essential` et `curl` de l'image finale de core | propriétaire de chaque module | build:cfao-core, build:cfao-needs/api, build:cfao-planning/api | l'API démarre et répond en recette ; `docker exec id` ≠ root | oui : 0 `USER` dans ces 3 Dockerfiles (supervision et comptes rendus en ont un) |
| 12 | `aud` obligatoire : refuser le démarrage si `OIDC_AUDIENCE` est vide (needs, core) | propriétaire du module | | test : jeton sans audience refusé | non |

## Phase 2 : exploitation
| # | Action | Session | Verrous | Preuve |
|---|---|---|---|---|
| 5 | Ancre compose commune `x-durci` (cap_drop ALL, no-new-privileges, read_only avec tmpfs) | cfaoacademy-cf | recette-restart | chaque service démarre ; ceux qui écrivent ont leur volume ou tmpfs |
| 6 | Rotation des journaux (`x-journaux` ou daemon.json) ; sortie d'audit Cerbos | cfaoacademy-cf | deploy:serveur pour daemon.json | `docker inspect` : max-size présent |
| 7 | `pg_dump` planifié des 6 bases, **et un test de restauration** | cfaoacademy-cf, puis l'utilisateur pour le serveur | deploy:serveur | restauration réussie sur une base vide, comptage des tables |

## Phase 3 : CI et chaîne de livraison
Le dépôt n'a plus de minutes Actions : ces contrôles doivent aussi pouvoir tourner en local (`make` ou script).
| # | Action | Session |
|---|---|---|
| 10 | Job CI supervision ; Dependabot pour needs, planning, comptes rendus, supervision, maven Keycloak | cfaoacademy-cf |
| 18 | Actions épinglées par SHA ; `contents: write` limité au job qui publie, retirer `secrets: inherit` | cfaoacademy-cf |
| 20 | Gitleaks : ne plus exclure tout `keycloak/config` ni `*.env.example` (exclure des fichiers précis) | cfaoacademy-cf |
| 8 | Scan d'images et dépendances (trivy, pip-audit, npm audit), SBOM | cfaoacademy-cf |
| 19 | Images de base avec digest | cfaoacademy-cf |
| 11 | Copies de `jwt_verifier` : les rendre identiques ou en faire un paquet commun, puis rendre le job auth-commune bloquant | à attribuer (touche tous les modules) |

## Phase 4 : chantiers plus larges, un par livraison
| # | Action | Session |
|---|---|---|
| 9 | Django 5.2 LTS (5.0.6 dans 5 modules, 5.1 dans comptes rendus) : un module à la fois, suite de tests complète | propriétaire de chaque module |
| 17 | PDP Cerbos unique (`cfao-pdp`) : déjà au plan fédération ; vérifier si les politiques supervision manquent dans `cfao-cerbos:v0.2.0` | cfao-planning |
| 15 | Edge : CSP, nosniff, frame-ancestors, `limit_req` sur login et jeton. **Test UI avant livraison** : une CSP trop stricte casse les écrans | cfao-planning (edge) + portails (test UI) |
| 13, 14 | Audiences du jeton portail ; `directAccessGrants` et jokers `192.168.*` du client cfao-spa | cfaoacademy-cf (realm) |

## Faibles (à glisser dans les commits voisins)
`ARG VERSION` après les `COPY` (edge, keycloak), `.dockerignore` (cerbos, needs), ports et `admin/admin` du compose de dev racine, test Cerbos pour `manager_scope.yaml`, restes de cfao-needs/keycloak et cfao-operations en root.

## Vérifications de sentinelle (19/11/2026, lecture du disque, fichiers suivis par git)
| # | État | Ce qui est observé |
|---|---|---|
| 5 | oui | `cap_drop` / `no-new-privileges` / `read_only` présents seulement dans supervision, edge et frontend prod ; absents des compose de core, needs, planning, comptes rendus |
| 6 | oui | `x-journaux` (max-size 10m) seulement dans comptes rendus ; aucun `logging:` ailleurs |
| 7 | oui | aucun `pg_dump` planifié ; une commande manuelle dans `cfao-comptes-rendus/MISE_A_JOUR.md:51` ; aucun test de restauration |
| 8 | oui | aucune occurrence de trivy, pip-audit, npm audit, SBOM dans `.github`, `Makefile`, `scripts` |
| 10 | oui | `dependabot.yml` couvre frontend, operations, core (pip), actions, docker `/` ; manquent needs, planning, comptes rendus, supervision, maven Keycloak. Job CI supervision : non vérifié |
| 11 | oui, plus grave que prévu | deux familles de `jwt_verifier.py` : core, needs, comptes rendus identiques ; planning et supervision diffèrent (fonction `prechauffer` en plus). Le job `auth-commune` compare à core : il échoue pour ces deux copies (blocage réel sur GitHub non vérifié) |
| 12 | oui | sans audience, `jwt_verifier.verify` ne vérifie pas `aud` (`verify_aud` faux). Core : défaut vide dans `base.py:66` ; needs : `base.py:96`. Comptes rendus refuse déjà le démarrage (`oidc.py:26`) : modèle à reprendre |
| 13 | non | audiences du jeton portail : realm non relu |
| 14 | oui | client `cfao-spa` : `directAccessGrantsEnabled: true` (l.261) et jokers `http://192.168.*:5173/*` et `:8000/*` (l.269-270) |
| 15 | oui | edge : seul `Strict-Transport-Security` posé (`edge.conf.template:22`) ; ni CSP, ni nosniff, ni frame-ancestors, ni `limit_req` |
| 17 | partiel | `cerbos/policies/resource_policies/supervision` existe à la racine ; son contenu dans l'image `cfao-cerbos:v0.2.0` reste à comparer |
| 18 | oui | 39 `uses:` en tag `@v`, 0 épinglé par SHA |
| 19 | oui | 0 `FROM` avec `@sha256` sur 22 |
| 20 | oui | `.gitleaks.toml` exclut tout `keycloak/config/`, tout `.env.example`, `Makefile`, `walkthrough/` |

## Points à trancher par l'utilisateur
1. Qui prend needs (phase 0) : `cfao-planning` est occupée par le chantier des chemins ; sinon réveiller `medacap-49`.
2. Purge de l'historique git pour les secrets : oui ou non.
3. Fenêtre de changement des secrets en prod (redémarrage de needs).
