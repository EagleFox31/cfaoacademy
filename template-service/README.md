# Template de Service Détachable — CFAO Academy

Ce dossier est un **kit de démarrage (boilerplate)** pour développer un nouveau service ou module métier destiné à l'écosystème CFAO Academy, **de manière 100 % autonome et réutilisable**, tout en garantissant une réintégration future sans friction.

---

## 1. Les 4 Règles d'Or d'Architecture

Tout nouveau service doit respecter ces 4 principes fondateurs :

| Règle | Principe | Comment l'appliquer |
|---|---|---|
| **1. Pas de base partagée** | Chaque service possède sa propre base de données. | Aucune requête SQL croisée vers `core-db`, `ops-db` ou `needs-db`. |
| **2. Inversion de dépendance** | Les données externes passent par un adaptateur d'interface (`Protocol`). | Deux modes gérés par `.env` : `standalone` (données locales/fixtures) et `integrated` (API REST centrale `GET /api/v1/core/me` avec cache court). |
| **3. Autorisation Cerbos** | Sécurité *Default-Deny* gérée par le PDP Cerbos. | Aucun droit codé en dur dans les vues (pas de `if user.role == ...`). Définir une policy YAML et ses tests unitaires. |
| **4. Identité OIDC** | Zéro mot de passe stocké ou géré dans le code applicatif. | Authentification par jeton Bearer JWT émis par Keycloak, vérifié via les clés publiques JWKS. |

---

## 2. Quickstart (Démarrage Local)

### Prérequis
* Docker & Docker Compose
* Make (optionnel mais recommandé)

### Lancement en 3 commandes
```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Démarrer la stack locale (API + PostgreSQL + Cerbos)
make up
# ou : docker compose up -d --build
# Le job service-migrate crée le schéma et le référentiel avant l'API :
# aucune commande manuelle (AGENTS.md §7).
```

Référentiel : une commande de seed par jeu de données, déclarée dans
`BOOTSTRAP_SEEDS` (`api/config/settings/base.py`) et écrite avec
`core.seeding.ensure` (créer seulement, jamais d'écrasement). Données de démo :
`BOOTSTRAP_DEMO_SEEDS`, chargées par `bootstrap --demo` en dev uniquement.

L'API est accessible sur : `http://localhost:8000`  
Le PDP Cerbos est accessible sur : `http://localhost:3592`

---

## 3. Structure du Template

```
template-service/
├── Makefile                 # Commandes usuelles (up, down, test, lint)
├── docker-compose.yml       # Stack locale isolée (API, DB, Cerbos)
├── Dockerfile               # Image de production multi-stage, non-root
├── .env.example             # Modèle de configuration documenté
│
├── cerbos/                  # Autorisation (PDP)
│   ├── cerbos.yaml          # Config Cerbos sans télémétrie externe
│   ├── policies/            # Politiques d'accès YAML
│   └── tests/               # Tests unitaires obligatoires (positifs ET négatifs)
│
└── api/                     # Backend Django / DRF
    ├── config/              # Configuration Django (base, dev, test)
    ├── core/                # Socle transverse (Auth, Cerbos, Identity Adapter)
    │   ├── auth/            # OIDC & IdentityProvider (standalone vs integrated)
    │   └── authz/           # Client Cerbos & permissions
    └── sample/              # Domaine métier exemple
        ├── models.py        # Modèle avec héritage de périmètre
        ├── views.py         # ViewSet avec PEP Cerbos
        └── tests/           # Tests unitaires API et permissions
```

---

## 4. Comment consommer des données d'un autre service (L'Adapter)

Ne jamais faire d'appel HTTP direct dispersé dans vos vues. Utiliser le pattern présent dans [`api/core/auth/identity.py`](api/core/auth/identity.py) :

```python
from core.auth.identity import get_identity_provider

# Dans votre vue ou service :
provider = get_identity_provider()
user_scope = provider.resolve(principal)

# En mode standalone  -> lit le profil local / fixture
# En mode integrated  -> appelle GET /api/v1/core/me avec cache de 60s
```

Pour basculer d'un mode à l'autre, **aucune ligne de code n'est modifiée** :
* En local : `DEPLOYMENT_MODE=standalone`
* En intégration plateforme : `DEPLOYMENT_MODE=integrated`

---

## 5. Tests & Validation

```bash
# Exécuter les tests unitaires du code
make test

# Exécuter les tests des règles de sécurité Cerbos
make policy-test
```

---

## 6. Checklist avant soumission (Pull Request)

- [ ] La stack démarre avec `docker compose up` sur une machine vierge.
- [ ] Aucun secret en clair n'est versionné (vérifié par Gitleaks).
- [ ] Le Dockerfile tourne sous un utilisateur non-root.
- [ ] Les politiques Cerbos comportent des tests positifs ET négatifs (`make policy-test`).
- [ ] Les dépendances externes passent par une interface à double implémentation.

---

## 7. Guide pas-à-pas — créer votre premier endpoint

Le dossier [`api/sample/`](api/sample/) est un domaine métier d'exemple. Pour démarrer votre propre service, dupliquez-le et adaptez-le : c'est le chemin le plus rapide pour avoir un endpoint protégé par Cerbos en moins d'une heure.

### Étape 1 — Dupliquer le domaine d'exemple

```bash
cp -r api/sample api/mon_domaine
```

Puis renommez les références dans les fichiers du nouveau dossier (`SampleItem` → `MonEntite`, `sample_resource` → `mon_domaine_resource`, etc.).

### Étape 2 — Définir votre modèle avec les attributs de périmètre

Dans `api/mon_domaine/models.py`, tout modèle qui doit être soumis à l'autorisation Cerbos **doit porter deux champs** : le nœud organisationnel et la marque. Ils serviront d'attributs de ressource dans la policy.

```python
class MonEntite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ... vos champs métier ...
    scope_node = models.CharField(max_length=64)   # ex: "CMR", "CMR-DLA"
    brand = models.CharField(max_length=64)         # ex: "TOYOTA"
```

### Étape 3 — Déclarer la policy Cerbos

La plateforme n'a qu'un PDP : la policy d'un module déployé vit dans le bundle commun, `../cerbos/policies/resource_policies/<module>/`, ses tests dans `../cerbos/tests/<module>/` (le dossier `cerbos/` du gabarit n'est qu'un exemple autonome). Calquez-vous sur [`sample_resource.yaml`](cerbos/policies/resource_policies/sample_resource.yaml). La règle « *la ressource est dans mon périmètre* » s'écrit toujours de la même manière :

```yaml
condition:
  match:
    all:
      of:
        - expr: request.resource.attr.scopeNode in request.principal.attr.scopeNodes
        - expr: request.resource.attr.brand in request.principal.attr.brands
```

### Étape 4 — Écrire les tests Cerbos (positifs ET négatifs)

Dans `cerbos/tests/mon_domaine_resource_test.yaml`, prévoir **au minimum** :

1. Un principal autorisé qui accède à sa ressource → `EFFECT_ALLOW`
2. Le même principal qui tente d'accéder à une ressource **hors de son périmètre** → `EFFECT_DENY`
3. Un principal sans rôle qui tente la même action → `EFFECT_DENY`

Les tests négatifs ne sont pas optionnels : ils garantissent que la policy refuse bien ce qu'elle doit refuser.

### Étape 5 — Protéger le ViewSet par le PEP

Dans `api/mon_domaine/views.py`, chaque action sensible appelle `enforce_permission` **avant** de lire ou modifier les données. Le pattern est déjà en place dans l'exemple :

```python
def retrieve(self, request, *args, **kwargs):
    instance = self.get_object()
    principal = self.get_principal(request)
    resource = {
        "kind": "mon_domaine_resource",
        "id": str(instance.id),
        "attr": {
            "scopeNode": instance.scope_node,
            "brand": instance.brand,
        },
    }
    enforce_permission(principal, resource, "read")
    # ... suite du traitement
```

### Étape 6 — Déclarer les routes

Dans `api/mon_domaine/urls.py`, ajoutez votre ViewSet au router DRF, puis incluez le fichier dans [`api/config/urls.py`](api/config/urls.py).

### Étape 7 — Valider

```bash
make policy-test   # Les règles Cerbos passent (positifs + négatifs)
make migrate       # La table est créée
make test          # Les tests Python passent
curl http://localhost:8000/api/v1/mon-domaine/   # L'endpoint répond
```

---

## 8. Le modèle de périmètre (scope)

L'autorisation CFAO Academy repose sur **trois dimensions** combinées en ET logique :

| Dimension        | Côté *principal* (utilisateur)    | Côté *ressource*                    |
|------------------|-----------------------------------|-------------------------------------|
| Organisationnel  | `scopeNodes: ["CMR", "CMR-DLA"]`  | `scopeNode: "CMR-DLA"`              |
| Département      | `departments: ["motors"]`         | `department: "motors"`              |
| Marque           | `brands: ["TOYOTA"]`              | `brand: "TOYOTA"`                   |

**Lecture :** un principal a accès à une ressource si et seulement si **chacune des trois dimensions correspond**. Pour l'organisation, la correspondance est une **inclusion** (`scopeNode ∈ scopeNodes`) : un directeur filiale qui porte `scopeNodes: ["CMR"]` voit toutes les ressources dont le `scopeNode` figure dans sa liste de nœuds autorisés.

En pratique, dans vos policies, la condition fondamentale est toujours :

```yaml
expr: request.resource.attr.scopeNode in request.principal.attr.scopeNodes
```

Ce qui signifie : *« le nœud organisationnel de la ressource figure dans la liste des nœuds auxquels le principal a accès »*.

Les listes `scopeNodes` et `brands` du principal sont construites côté Identity Provider — en mode `standalone`, elles sont figées en dur dans `LocalMockIdentityProvider`. En mode `integrated`, elles proviennent de l'API centrale `GET /api/v1/core/me`.

Pour aller plus loin sur les cas complexes (rôles cumulés, scope flottant, marques partielles), consulter les policies de référence déjà en production dans [`../cerbos/policies/resource_policies/needs/`](../cerbos/policies/resource_policies/needs/) et le document [`../architecture.md`](../architecture.md) §6.

---

## 9. Migrations Django

Toute modification du schéma de base de données passe par le mécanisme de migrations de Django. **Ne jamais modifier les fichiers de migration déjà commités** — toujours en générer de nouveaux.

### Workflow standard

```bash
# 1. Modifier vos modèles dans api/mon_domaine/models.py
# 2. Générer la migration correspondante
docker compose exec service-api python manage.py makemigrations mon_domaine

# 3. Appliquer la migration à la base
make migrate
```

Le fichier généré (`api/mon_domaine/migrations/0002_*.py`) **doit être commité** au même titre que le code du modèle.

### Revenir en arrière

Pour annuler une migration non encore poussée :

```bash
docker compose exec service-api python manage.py migrate mon_domaine 0001_initial
```

### Repartir de zéro (dev local uniquement)

```bash
make down
docker volume rm cfao-template-service_service-db-data
make up
```

> ⚠️ Ne jamais faire cela sur un environnement partagé ou de production.

---

## 10. Références utiles

- **Architecture globale de la plateforme** : [`../architecture.md`](../architecture.md) — principes directeurs, modèle de scope, flux PEP → PDP
- **Policies Cerbos de référence** : [`../cerbos/policies/resource_policies/needs/`](../cerbos/policies/resource_policies/needs/) — exemples réels en production, avec tests complets
- **Spécification du module Recueil des besoins** : [`../docs/SPEC_RECUEIL_BESOINS_2027.md`](../docs/SPEC_RECUEIL_BESOINS_2027.md) — cas d'étude d'un service détachable réel
- **Patron de module sécurisé** : skill projet `module-securise` dans `.claude/skills/`
- **Normes DevSecOps** : skill projet `cerbos-policy` dans `.claude/skills/`
