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

# 3. Appliquer les migrations et charger les données de test
make migrate
make seed
```

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
