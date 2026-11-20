# Prérequis avant Azure : grille par module (lot 1b)

Relevé fait le 19/11 dans le dépôt (pas sur le serveur). Il complète PLAN-durcissement.md et PLAN-secrets.md sans refaire leurs constats.
Légende : **oui** = conforme, **non** = à corriger avant Azure, **?** = à vérifier dans l'inventaire du serveur (lot 1a).

| Module (image) | Base | Tourne sans root | Healthcheck | Secrets sans valeur par défaut | Job `migrate` séparé | Journaux sur la sortie standard |
|---|---|---|---|---|---|---|
| edge | nginx-unprivileged 1.27 | oui | oui (compose prod) | oui | sans objet | oui (nginx par défaut) |
| keycloak | keycloak 26.5.5 | oui (image officielle) | oui (compose prod) | oui | sans objet (Keycloak migre sa base lui-même) | oui |
| cerbos | cerbos 0.40.0 | oui (image officielle) | compose racine seulement | sans objet | sans objet | oui |
| cfao-core | python 3.12-slim | **non** | compose racine seulement | ? | oui (`core-migrate`) | erreurs seulement, pas l'accès |
| cfao-operations | node 22 slim | **non** (l'utilisateur `node` existe mais n'est pas activé) | compose racine seulement | ? | ? | ? |
| comptes rendus, API | python 3.12-slim | oui | oui | oui | oui | oui (accès et erreurs) |
| comptes rendus, gateway | nginx 1.27-alpine | **non** | ? | sans objet | sans objet | oui |
| cfao-needs, API | python 3.12-slim | **non** | oui | **non** (constat de PLAN-secrets, correction en cours sur `durcissement/needs`) | oui | erreurs seulement |
| cfao-needs, gateway | nginx 1.27-alpine | **non** | ? | sans objet | sans objet | oui |
| cfao-planning, API | python 3.12-slim | **non** | ? (compose de prod absent du dépôt) | **non** (clé handshake à défaut vide, sans risque) | ? | erreurs seulement |
| hub mail | python 3.12-slim | oui | oui (compose de dev) | ? | oui | ? |
| cfao-supervision | ? | ? | ? | ? | ? | ? (aucun Dockerfile ni compose suivi dans le dépôt) |

## Messagerie : passage à Azure Communication Services (décision de l'utilisateur du 19/11)
Envoi par SMTP authentifié ACS : `smtp.azurecomm.net`, port 587, STARTTLS. L'utilisateur SMTP est rattaché à une application Entra ID, et son mot de passe est le secret de cette application, gardé dans Key Vault. Le SMTP suffit : le code d'envoi existant est conservé, sans SDK à ajouter.

| | Hub mail (`cfao-academy-mail`) | Besoins (`cfao-needs`) |
|---|---|---|
| Connexion authentifiée | déjà prévue (`MAIL_SMTP_USERNAME` / `PASSWORD`, `backends.py` l.75-76) | **absente** : pas de `login()` (`backends.py` l.50-53), pas de variable pour l'utilisateur ni pour le mot de passe |
| STARTTLS | variable `MAIL_SMTP_USE_TLS`, `False` par défaut | variable `NEEDS_SMTP_USE_TLS`, `False` par défaut |
| Certificat du serveur vérifié | **non** : `starttls()` sans contexte n'en vérifie aucun | **non**, même cause |
| Valeur par défaut à retirer | `MAIL_SMTP_HOST=smtp.cfao.corp`, port 25 (`settings/base.py` l.78-79) | port 25 (`settings/base.py` l.123) |
| Expéditeur | `helpdeskcm@cfao.com` | `no-reply@cfao.com` |

Changements dans le code (petits, un commit par module) :
1. Passer `ssl.create_default_context()` à `starttls()` dans les deux modules. Sans cela, on accepte un faux serveur au milieu de l'échange (sécurité, utile dès aujourd'hui).
2. Needs : ajouter la connexion authentifiée, comme le hub. Autre voie, plus simple : needs envoie **par le hub mail**, qui devient le seul expéditeur (Keycloak passe déjà par lui). C'est la voie que je recommande, à trancher avec manitou.
3. Supprimer les valeurs par défaut `smtp.cfao.corp` et 25. Si le mode `smtp` est choisi sans hôte, le module refuse de démarrer (même règle que pour les secrets).
4. Exemples d'env et compose de prod : 587, TLS activé, utilisateur et mot de passe tirés de Key Vault.

À régler hors du code (point pour l'utilisateur) :
- **Domaine d'envoi** : pour envoyer depuis `@cfao.com`, il faut que le DNS de cfao.com accepte un enregistrement de vérification, l'ajout d'ACS au SPF et deux CNAME DKIM, et que la règle DMARC du groupe soit respectée. Ce DNS appartient à l'informatique du groupe. Si l'accès est trop lent, on prend un sous-domaine dédié (par exemple un sous-domaine academy délégué) ; sinon, en dernier recours, le domaine fourni par Azure (adresse `azurecomm.net`, peu crédible pour les destinataires et à volume limité).
- **Volume** : les quotas d'envoi d'ACS démarrent bas sur un domaine neuf. Il faut estimer le volume mensuel et demander une hausse si besoin.
- **Secret de l'application Entra** : il a une date d'expiration. Il faut une alerte avant cette date, sinon les mails s'arrêtent sans bruit.

## À corriger avant Azure (par ordre de coût)
1. **Sans root** : 6 images. Pour les Python, ajouter un `USER` comme dans comptes rendus. Pour operations, `USER node`. Pour les deux gateways nginx, prendre `nginx-unprivileged` comme edge. Sur Azure, les gateways disparaissent peut-être : edge peut servir les fronts. C'est à trancher à l'étape 4.
2. **Healthcheck dans l'image ou dans la définition de l'app** : Container Apps n'exécute pas le healthcheck du compose. Il faut des sondes HTTP (`/health` ou équivalent) déclarées dans le Bicep. Il faut donc un point de santé HTTP par API (à vérifier : lesquelles en ont un).
3. **Journaux d'accès** : ajouter `--access-logfile -` à gunicorn pour core, needs, planning et mail, comme dans comptes rendus. Sans cela, Log Analytics ne voit pas les requêtes.
4. **Compose de prod manquants** : planning et supervision n'en ont pas dans le dépôt. Il faut une copie sans valeurs, tirée de l'inventaire 1a.
5. **Secrets** : suite de PLAN-secrets (needs en cours, handshake), puis contrôle local qui refuse un défaut sur `*_PASSWORD`, `*_SECRET*`, `*_KEY`.
