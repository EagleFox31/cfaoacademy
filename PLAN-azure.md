# Plan : préparer le déménagement vers Azure (offre Orange Business v4.0)

Porteur : sentinelle. Coordination : manitou. Rien ne touche la prod ni le compte Azure sans accord de l'utilisateur et verrou `deploy:serveur`.

## Cadre validé (20/11)
- Offre Orange du 26/10, réf. OBC/ICT/AZ-WEB/2026-10/005, v4.0 : 100 % PaaS, région France Centre, secours France Sud.
- 847 955 FCFA HT par mois (socle 709 994 + variable estimée 137 961), mise en service 720 000, première année 10 895 460 HT.
- Hors périmètre Orange : déploiement, migration et supervision sont faits par CFAO (donc par nous).
- Le comparatif V19 (533 008 par mois) n'est pas retenu.

## Correspondance avec l'existant
| Aujourd'hui | Azure |
|---|---|
| Serveur 192.168.10.155, compose par module | Azure Container Apps (un conteneur = une app, 0 à N réplicas) |
| Images Docker Hub antifragile237 | Azure Container Registry privé (identité managée) |
| Caddy + edge + zrok | Front Door Premium (WAF) puis Private Link vers l'environnement ; edge reste le point d'entrée interne |
| Postgres par module (conteneur) | PostgreSQL Flexible Server (Private Endpoint) |
| Mongo (MEDACAP) | Azure DocumentDB |
| `.env` en 600 sur le serveur | Key Vault + identités managées |
| Keycloak realm `cfao` | Reste publié dans Container Apps ; fédération avec Entra ID (SSO, MFA) à cadrer |
| Cerbos PDP unique | Conteneur interne (un seul PDP, politiques versionnées dans l'image) |
| Job `migrate` du compose | Container Apps Job, lancé avant les apps (AGENTS.md §7) |
| Fichiers/volumes | Blob Storage GZRS |
| Journaux | Log Analytics, rétention 1 an, export |

## Étapes (dans l'ordre)
1. **Inventaire du déployé** : liste des conteneurs, variables, volumes, ports, dépendances, taille des bases. Sortie : tableau module par module. Lecture seule.
2. **Pré-requis dans le dépôt** (avant tout Azure) : plus aucun secret par défaut (PLAN-secrets), images non-root, healthchecks sur chaque conteneur, configuration 100 % par variables, journaux sur la sortie standard, migrations idempotentes en job séparé.
3. **Pipeline de livraison** : CI qui construit, analyse (Trivy), pousse dans ACR, crée une révision. Décision à prendre : GitHub Actions ou Azure DevOps (le dépôt repasse en privé début décembre, minutes Actions à vérifier).
4. **Infra décrite en code** (Bicep ou Terraform, au choix de sentinelle, un seul outil) : réseau, Private Endpoints, Key Vault, ACR, bases, Container Apps, Front Door. Rejouable, idempotente.
5. **Environnement de test** : déploiement complet sur un abonnement de préproduction (option Orange, version réduite), jeu de données de démo, smoke test sur base vide, second démarrage sans écriture.
6. **Données** : plan de bascule des bases (dump/restore, durée mesurée), test de restauration, objectifs de reprise (point et durée) écrits.
7. **Identité** : cadrer realm `cfao` + Entra ID (qui s'authentifie où), audiences, session 8 h / 30 min.
8. **Bascule** : date et fenêtre fixées par l'utilisateur, retour arrière prêt (ancien serveur conservé), DNS/domaine, surveillance renforcée les premiers jours.
9. **Après** : alertes de coût (Cost Management), revue du dimensionnement à 3 mois avec Orange, extinction de l'ancien serveur.

## Points à décider par l'utilisateur
- Pipeline : GitHub Actions ou Azure DevOps.
- Préproduction : identique à la production ou réduite (option payante chez Orange).
- Domaine public et certificat TLS : qui les porte.
- Date cible de bascule.

## À demander à Orange
- Délai de mise à disposition de l'abonnement (annoncé 5 jours ouvrés).
- Accès nominatifs et rôles pour l'équipe CFAO.
- Contact : indiqué dans l'offre.

## Relecture de sentinelle (19/11)
Corrections et compléments, vérifiés dans le dépôt sauf mention « à vérifier » :
1. **Date du cadre** : écrite « 20/11 », la validation date du 19/11.
2. **Outil d'infra : Bicep.** Un seul cloud, pas de fichier d'état à protéger (avec Terraform, l'état contient les secrets en clair), simulation `what-if` avant chaque passage, modules officiels Azure Verified Modules à réutiliser plutôt qu'à écrire (RAIDER : Adopt).
3. **Messagerie, bloquant** : le hub mail et needs envoient par `smtp.cfao.corp:25` (`cfao-academy-mail/.env.example` l.18-19, `cfao-needs/.env.example` l.44). Ce relais interne n'est pas joignable depuis Azure, et Azure bloque la sortie sur le port 25. Il faut choisir : liaison VPN vers le réseau CFAO, relais Office 365 sur le port 587, ou Azure Communication Services.
4. **Réseau CFAO, à inventorier** : tout ce qui lit aujourd'hui le partage A: ou un serveur interne (besoins copiés chaque soir, imports) ne marchera plus sans liaison VPN ou sans un dépôt de fichiers dans Azure. La question « faut-il un VPN entre Azure et CFAO ? » est à poser à Orange, car elle n'est pas dans l'offre (à vérifier).
5. **Fichiers** : les comptes rendus montent un dossier (`/donnees` dans le dépôt, `/data` sur le serveur : 75 Mo), et planning lit le partage (12 Go). Voir `docs/azure/inventaire.md`. Un volume monté devient **Azure Files**, pas Blob. Blob demande de modifier le code (`stockage.py`).
6. **Job `migrate`** : Container Apps ne connaît pas `depends_on`. C'est la chaîne de livraison qui lance le job, attend sa réussite, puis crée la révision des apps. À écrire dans l'étape 3.
7. **Keycloak** : avec plusieurs réplicas, il faut un cache partagé en JDBC (pas de découverte réseau dans Container Apps), sinon on en reste à 1 réplica ; il faut aussi les en-têtes de proxy et un nom d'hôte fixe.
8. **Front Door vers Container Apps par Private Link** : demande un environnement interne à profils de charge (workload profiles). À fixer dès l'étape 4 (à vérifier dans l'offre Orange).
9. **Postgres** : un serveur Flexible, une base et un compte par module, chaque compte limité à sa base (moindre privilège). Pas un serveur par module.
10. **MEDACAP sur DocumentDB** : DocumentDB est compatible avec le protocole Mongo, mais pas sur 100 % des requêtes. Il faut tester les agrégations de MEDACAP avant la bascule (à vérifier).
11. **Modules hors dépôt** : le compose de prod de planning n'existe que sur le serveur. L'inventaire doit en tirer une copie sans valeurs dans le dépôt.
12. **zrok** disparaît (remplacé par Front Door) : à noter dans l'étape 8.

Points ajoutés pour l'utilisateur : la messagerie (point 3), la liaison avec le réseau CFAO (point 4).

**Décision de l'utilisateur (19/11) : messagerie par Azure Communication Services** (déjà dans l'offre Orange). À prévoir : domaine d'envoi vérifié (SPF, DKIM, DMARC), adaptation du hub mail et de needs (plus de `smtp.cfao.corp:25`). Le SMTP d'ACS s'authentifie par un secret d'application Entra qui expire (24 mois au plus) : le ranger dans Key Vault avec sa date d'expiration et poser une alerte Azure Monitor 30 jours avant (événement Key Vault « SecretNearExpiry »), envoyée au support applicatif. Sans cela, les mails s'arrêtent sans prévenir le jour de l'expiration. Question VPN posée à Orange (texte préparé par manitou, envoi par l'utilisateur).

## Lot 1 (fait le 19/11) : `docs/azure/prerequis.md` (1b) et `docs/azure/inventaire.md` (1a)
- **1a, inventaire du serveur en lecture seule** : conteneurs, images et versions, noms de variables (jamais les valeurs), volumes et tailles, ports, taille des bases, tâches planifiées, sorties vers le réseau CFAO (SMTP, partage, autres). Sortie : `docs/azure/inventaire.md`, un tableau par module. Estimation : 2 h.
- **1b, grille des prérequis dans le dépôt** : par module, secrets par défaut, utilisateur non root, healthcheck, journaux sur la sortie standard, configuration par variables, job `migrate`. On réutilise PLAN-durcissement.md sans refaire les constats. Estimation : 2 h.
- Aucun geste serveur, aucun build, aucun accès Azure.

## Preuves attendues
Infra recréée à vide par le code ; smoke sur base vide ; second démarrage sans écriture ; restauration d'une base testée ; accès aux services de données refusé depuis Internet ; bascule répétée en préproduction.
