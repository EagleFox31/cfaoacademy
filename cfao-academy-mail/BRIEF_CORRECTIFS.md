# Brief de correctifs — cfao-academy-mail

**Pour :** l'équipe qui a construit le hub mail.
**Origine :** relecture du 22/10/2026, avec chaque point reproduit en local (pas une impression).
**Cadre :** le standard [RAIDER](../RAIDER.md) (Reusable, Agnostic, Idempotent, Durable, Engineering-grade, Retroactive). Chaque point indique le principe qu'il enfreint : relire ce principe avant de corriger.
**Règle de travail :** corriger dans l'ordre. Pour chaque point : d'abord un test qui échoue, puis le correctif, puis le test vert, et toute l'ancienne suite doit rester verte (RAIDER-D). À chaque point, ajouter une entrée dans [`docs/engineering/lessons-learned.md`](../docs/engineering/lessons-learned.md) (format en fin de fichier). Ne rien déclarer « fait » sans la sortie de la commande qui le prouve.

---

## Ce qui est bon (à garder)

- Contrat OpenAPI généré depuis le catalogue, avec un test qui vérifie que le fichier publié colle au catalogue.
- Compte rendu incomplet refusé en 400, sans envoi.
- `X-Mail-Service-Key` comparée en temps constant, et clé vide côté serveur = tout refusé (fail-closed).
- Contexte échappé dans le HTML.
- Route gateway résolue à la requête : un hub arrêté ne casse pas les autres routes.

## Ce qui ne va pas

### 1. Bloquant — aucun mail ne part en Docker `RAIDER-D · E`

**Constat.** `views.py` appelle `async_task(...)` (django-q, broker ORM). Rien ne lance `python manage.py qcluster` : ni le `Dockerfile` (gunicorn seul), ni `docker-compose.yml`. Un appel répond 201, le message reste `APPROVED` pour toujours.

**Pourquoi les tests n'ont rien vu.** `config/settings/test.py` met `Q_CLUSTER["sync"] = True` : les tâches s'exécutent dans le processus de test. Le test prouve le code d'envoi, pas le déploiement.

**Correctif.**
- Ajouter un service `mail-worker` dans `docker-compose.yml` : même image, même `env_file`, `command: python manage.py qcluster`, `depends_on: mail-db (healthy)` et `mail-api (healthy)` (la migration est faite par `mail-api`).
- Healthcheck du worker : par exemple `python manage.py qmonitor --run-once` ou un contrôle sur le processus.
- Vérification attendue : `make up`, un `enqueue` avec `MAIL_EMAIL_BACKEND=console`, puis le message passe à `SENT` dans les logs du worker. Coller la sortie dans le walkthrough.

**Leçon.** Un mode `sync` en test ne couvre pas le chemin asynchrone de prod. Toute file de tâches doit avoir son consommateur déclaré dans le déploiement, et un test (ou smoke test) qui le prouve.

### 2. Sécurité — `module_url` n'est pas validée quand elle passe par `context` `RAIDER-E (contrats explicites)`

**Constat reproduit.** `context.module_url = "javascript:alert(1)"` est accepté (201, `APPROVED`) et finit dans le `href` du bouton. Le champ de premier niveau `module_url` passe par `URLField`, mais `queue.py:75` reprend `payload.get("module_url")` sans aucun contrôle.

**Correctif.** Dans `services/queue.py`, valider `destination` quel que soit son chemin d'arrivée : `URLValidator(schemes=["https"])` (accepter `http` seulement si `DEBUG`), sinon `ForbiddenSend` → 400. En option, une liste blanche d'hôtes (`MAIL_ALLOWED_LINK_HOSTS`) : le hub signe au nom de `helpdeskcm@cfao.com`, un lien vers un domaine tiers devient du phishing.

**Tests.** `javascript:`, `data:`, `http://` en prod, et un hôte hors liste blanche → 400.

**Leçon.** Une donnée qui peut arriver par deux chemins doit être validée **au point de convergence** (le service), pas seulement dans le sérialiseur d'un des deux chemins.

### 3. Sécurité — `context.reply_to` n'est pas validé `RAIDER-E`

**Constat reproduit.** `context.reply_to = "pas-un-email"` est accepté et stocké tel quel dans `reply_to`.

**Correctif.** Même endroit, même logique : `validate_email` sur `header_reply`, sinon 400.

**Tests.** Une adresse invalide et une adresse avec retour à la ligne → 400.

**Leçon.** Identique au point 2 : la validation ne doit pas dépendre du chemin d'arrivée.

### 4. Exposition — l'envoi est publié sur le gateway public `RAIDER-E (moindre privilège)`

**Constat.** `gateway/nginx.conf` route tout `/api/v1/mail/` sur le port 8000 public, donc `POST /messages/enqueue` aussi. Seule la clé protège l'envoi au nom de `helpdeskcm@cfao.com`. Aucun producteur n'a besoin du gateway : ce sont des conteneurs qui peuvent joindre `mail-api` sur le réseau `cfao-academy-mail_default`.

**Correctif.** Ne publier que la lecture : `location = /api/v1/mail/healthz` et `location = /api/v1/mail/contract`. Pour `/api/v1/mail/messages/`, renvoyer `403` (ou ne pas router). Les producteurs appellent `http://mail-api:5180` en interne.

**Leçon.** Default-deny aussi au niveau réseau : on n'expose une route que si un client externe en a besoin. « Protégé par une clé » ne justifie pas l'exposition.

### 5. Contrat — le serveur est moins strict que le contrat publié `RAIDER-D (contrats) · E`

**Constat reproduit.** Le contrat dit `locale ∈ {fr, en}`, mais `locale = "de"` est accepté en 201, puis le message échoue au rendu (`MissingTranslation`). L'appelant croit son mail parti.

**Correctif.** `EnqueueSerializer.locale = ChoiceField(choices=["fr", "en"], default="fr")`. Vérifier les autres écarts entre le contrat et le sérialiseur (`additionalProperties: false` du contrat, champs inconnus ignorés par DRF) et choisir : soit le serveur refuse, soit le contrat le permet. Ajouter un test qui valide quelques requêtes contre le schéma OpenAPI (`jsonschema`) et vérifie que le serveur donne la même réponse.

**Leçon.** Un contrat publié est une promesse. Il doit être testé **contre le serveur**, pas seulement contre le catalogue dont il est généré.

### 6. Tests locaux — `make test-mail` échoue `RAIDER-A · D`

**Constat reproduit.** `pytest` plante sans `MAIL_SECRET_KEY` : `base.py` lit `env("MAIL_SECRET_KEY")` à l'import, avant que `test.py` ne la remplace. Ça passe en CI seulement parce que `ci.yml` fournit la variable. De plus, `make test-mail` fait `pip install` dans l'interpréteur courant, contre la norme du projet (venv obligatoire).

**Correctif.**
- Dans `test.py`, poser `os.environ.setdefault("MAIL_SECRET_KEY", "test-secret-key")` **avant** `from .base import *`. Ne pas mettre de valeur par défaut dans `base.py` : la prod doit rester en échec si la clé manque.
- `make test-mail` : créer et utiliser `cfao-academy-mail/api/.venv` (même patron que `cfao-core` ou `cfao-needs`).

**Leçon.** « Les tests passent » doit être vrai depuis un clone propre, avec la commande documentée, pas seulement dans l'environnement où on les a lancés.

### 7. Mineur — l'idempotence sur `correlation_id` n'est pas garantie `RAIDER-I`

**Constat.** On fait un `filter().first()` puis un `create()`, sans contrainte d'unicité en base. Deux appels simultanés créent deux mails.

**Correctif.** Une `UniqueConstraint` conditionnelle sur `correlation_id` (non nulle, statut différent de `REJECTED`) + migration, et rattraper `IntegrityError` pour renvoyer l'existant en 200.

**Leçon.** L'idempotence se garantit en base, jamais par une lecture suivie d'une écriture.

### 8. Traçabilité — le walkthrough est périmé `RAIDER-D (failure memory)`

`walkthrough/README.md` annonce « pytest 5/5 » alors qu'il y en a 14, et ne dit pas que le chemin asynchrone n'a pas été testé. Après les correctifs, mettre à jour `walkthrough/15-cfao-academy-mail-amorcage.md` avec les vraies sorties et le périmètre **non couvert**.

### 9. CI — le job `mail` tourne à chaque push `RAIDER-E (exécution proportionnelle)`

**Constat.** Dans le diff de `.github/workflows/ci.yml`, le job `mail` n'a pas de filtre de chemins : un changement de CSS dans `frontend/` relance l'installation Python et pytest du hub. C'est l'anti-pattern « changement sur une seule surface, CI complète ».

**Correctif.** Ajouter un job `changes` avec `dorny/paths-filter` (décision **Adopt** : Action maintenue et standard, pas de script maison), puis lancer `mail` seulement si `if: needs.changes.outputs.mail == 'true'`. Le filtre `mail` couvre `cfao-academy-mail/**` et `.github/workflows/ci.yml` (fichier transversal, donc fan-out légitime). Garder `workflow_dispatch` ou `workflow_call` pour une validation complète. Ne pas toucher aux filtres des autres jobs : c'est hors périmètre, à proposer à part.

**Vérification.** Une PR qui ne touche que `frontend/` doit marquer `mail` comme *skipped*, et une PR qui touche `cfao-academy-mail/` doit le lancer. Coller les deux résultats dans le walkthrough.

**Leçon.** Le rayon d'exécution de la CI doit suivre le rayon d'impact du changement. Le filtre de déclenchement est lui-même du code à tester.

---

## Critères de fin

- `make test-mail` vert depuis un shell sans variable d'environnement.
- Les nouveaux tests des points 2, 3, 5 et 7 sont dans la suite.
- Le smoke test Docker du point 1 est fait, et sa sortie est collée dans le walkthrough.
- `gateway/nginx.conf` ne publie plus `messages/`.
- Le job `mail` est ignoré sur une PR qui ne touche que le frontend (point 9).
- `docs/engineering/lessons-learned.md` contient une entrée par point, avec une prévention vérifiable pour chacune.
- La Definition of Done de [RAIDER.md](../RAIDER.md) est cochée dans le walkthrough, et chaque case non cochée est justifiée.
- Ne pas commiter sans accord. Commits au format `NN-x: résumé` + ligne `Avancement:`, sans mention d'outil.

## Les réflexes qui auraient évité ces erreurs

1. **Tester le déploiement, pas seulement le code** : chaque processus (API, worker, cron) doit être déclaré et démarré au moins une fois.
2. **Valider au point de convergence**, pas dans un seul des chemins d'arrivée.
3. **Exposer le minimum** : chaque route publique doit avoir un client externe identifié.
4. **Prouver depuis un clone propre** : la commande documentée, sans l'état de sa propre machine.
5. **Proportionner la CI** : un job ne tourne que si ses fichiers ou ses dépendances changent.
6. **Lire la mémoire avant d'agir** : `docs/engineering/lessons-learned.md` avant toute tâche proche d'un incident connu.

---

## Format d'une entrée de `docs/engineering/lessons-learned.md`

Une entrée par erreur **ou near miss** significatif. On ne réécrit jamais une entrée existante.

```markdown
### AAAA-MM-JJ — <titre court> (<module>)
- **Contexte / symptôme** : ce qui était faux, et dans quelles conditions.
- **Impact** : ce que ça casse, pour qui.
- **Détection** : qui l'a vu, comment (revue, test, CI, prod).
- **Cause racine** : pourquoi c'est arrivé (pas le symptôme).
- **Correctif** : fichier(s) et principe.
- **Prévention** : le test, la validation ou le guardrail CI ajouté pour empêcher la récidive.
- **Leçon généralisée** : la règle applicable ailleurs (l'ajouter à la synthèse si elle est nouvelle).
- **Catégorie** : architecture | sécurité | CI/CD | données | dépendances | infrastructure | release/déploiement | automatisation | UX | performance | tests | process
- **Récidive** : non | oui (lien vers l'entrée précédente, et contrôle renforcé)
```
