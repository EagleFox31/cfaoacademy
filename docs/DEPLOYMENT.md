# Déploiement & CI/CD — CFAO Academy

> GitHub héberge le **code** et la **CI** (build/test). La **CD** (images Docker → registry → serveurs Azure) est une étape distincte.  
> Complète [architecture.md](../architecture.md) §8 (secrets) et [BACKEND.md](../BACKEND.md) (socle local).

**État juin 2026** : CI en place (`.github/workflows/ci.yml`). Workflow CD (`cd.yml`) et infra Azure **à provisionner**.

---

## 1. Chaîne cible

```
Développeur → PR → CI (tests, pas de deploy)
                    ↓ merge develop / tag v*
              CD (GitHub Actions ou build Azure)
                    ↓
         Azure Container Registry (ACR)
         tags : 1.2.0 , 1.2.0-abc1234
                    ↓
         Azure Container Apps (staging / prod)
         secrets via Key Vault + Managed Identity
```

| Étape | Outil actuel / cible |
|-------|----------------------|
| Code | GitHub |
| CI (PR) | GitHub Actions — `ci.yml` |
| CD (images) | GitHub Actions `cd.yml` **ou** ACR Tasks |
| Registry | **Azure Container Registry (ACR)** |
| Runtime prod | **Azure Container Apps** (recommandé dans `architecture.md`) ou VM |
| Secrets prod | **Azure Key Vault** + identité managée user-assigned |

`docker-compose.yml` reste l’outil **dev local**. En prod, chaque service devient une **révision Container App** (ou conteneur sur VM), pas un `compose up` copié tel quel.

---

## 2. Images à publier

| Image | Source Dockerfile | Notes |
|-------|-------------------|--------|
| `cfao-academy/core` | `cfao-core/Dockerfile` | Django + gunicorn |
| `cfao-academy/operations` | `cfao-operations/Dockerfile` | Node/Express |
| `cfao-academy/frontend` | *à créer* | nginx + `frontend/dist` (build Vite) |
| `cfao-academy/gateway` | *à créer* | nginx, config `gateway/` |
| Cerbos / Keycloak | images **officielles épinglées** | policies/config versionnées dans le repo |

Convention de tags (immuables en prod) :

```text
<acr>.azurecr.io/cfao-academy/core:1.3.0
<acr>.azurecr.io/cfao-academy/core:1.3.0-a1b2c3d
```

Éviter de ne déployer que `:latest` en production.

---

## 3. Faut-il Jenkins ?

**Non, pas en priorité** pour ce projet (GitHub + Azure).

| Option | Quand la choisir |
|--------|------------------|
| **GitHub Actions → ACR → Azure** | Repo sur GitHub, cible Azure (**cas CFAO Academy**) |
| **Azure DevOps Pipelines** | IT impose l’écosystème Microsoft / Azure DevOps |
| **Jenkins** | Obligation groupe, réseau fermé sans accès runners cloud, orchestrateur unique existant |

Jenkins ajoute un composant à maintenir (controller, agents, plugins) sans gain décisif si GitHub Actions peut pousser vers ACR via **OIDC** (fédération d’identité, sans mot de passe ACR stocké dans GitHub).

---

## 4. Limites des runners GitHub (VM hébergées)

Les runners `ubuntu-latest` de GitHub Actions **ne sont pas illimités** sur un dépôt **privé**.

### Minutes par mois (repo privé)

| Plan GitHub | Minutes incluses / mois |
|-------------|-------------------------|
| Free / org Free | 2 000 |
| Team | 3 000 |
| **Enterprise Cloud** | **50 000** |

Au-delà → facturation à la minute (Linux standard ≈ ×1, Windows ×2, macOS ×10).  
**Repos publics** : runners standards illimités (gratuits).

Référence : [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Actions limits](https://docs.github.com/en/actions/reference/limits).

### Concurrence (jobs en parallèle)

| Plan | Jobs simultanés max |
|------|---------------------|
| Free | 20 |
| Team | 60 |
| Enterprise | 500 |

La CI actuelle (~5 jobs) reste dans ces plafonds.

### Autres limites utiles

| Limite | Valeur |
|--------|--------|
| Durée max d’un job (runner hébergé) | **6 h** |
| `ubuntu-slim` | timeout **15 min** — inadapté aux builds Docker |
| Artifacts + cache | quota selon plan (ex. Team ~2 Go artifacts, 10 Go cache) |

Les **images Docker** ne transitent pas par les artifacts Actions : on **push directement vers ACR** (bon pattern).

### Accès réseau Azure

Les runners GitHub sont sur Internet. Déploiement Azure :

- **OIDC** GitHub → Azure (recommandé) ;
- ou **self-hosted runner** dans le VNet Azure si l’IT bloque l’accès depuis l’extérieur.

---

## 5. Impact CD sur le quota de minutes

Ordre de grandeur :

| Pipeline | Durée typique |
|----------|----------------|
| CI seule (PR, sans Docker) | ~2–5 min |
| CD (build 2–3 images + push ACR + deploy) | ~10–20 min / run |

Sur **Team (3 000 min)** : ~150–300 déploiements CD / mois si CD **uniquement** sur `develop` / tags — suffisant au démarrage.

Devient serré si :

- build Docker sur **chaque PR** ;
- CD sur **toutes** les branches ;
- plusieurs environnements à chaque merge ;
- images lourdes sans cache.

---

## 6. Bonnes pratiques (éviter d’épuiser les minutes)

| Pratique | Détail |
|----------|--------|
| **Séparer CI et CD** | PR → tests uniquement ; CD sur `develop` (staging) et tag `v*` (prod) |
| **Chemins déclencheurs** | `paths: cfao-core/**` → rebuild `core` seulement |
| **Cache Docker** | `docker/build-push-action` + cache GHA ou cache registry ACR |
| **Build dans Azure** | `az acr build` / **ACR Tasks** : le build consomme du compute Azure, pas les minutes GitHub |
| **Self-hosted runner** | Petite VM Azure, proche d’ACR ; pas de quota minutes compute GitHub (coût VM + éventuelle redevance plateforme Actions sur self-hosted — voir facturation GitHub 2026) |
| **Environments GitHub** | `staging` auto, `production` avec **approbation manuelle** |

---

## 7. Workflows prévus

| Fichier | Déclencheur | Rôle |
|---------|-------------|------|
| `ci.yml` | PR, push `main` / `develop` | Cerbos, pytest, builds Node/Vite, Gitleaks — **pas de deploy** |
| `cd.yml` *(à ajouter)* | Push `develop` → staging ; tag `v*` → prod | Build images, push ACR, mise à jour Container Apps |

Exemple de flux release :

```text
PR → CI verte → merge develop → CD staging (image :staging-abc123)
merge main + tag v1.3.0 → approbation → CD prod (image :1.3.0)
```

---

## 8. Secrets & configuration

- **Aucun secret réel** dans le dépôt (`.env.example` seulement).
- **Prod** : Key Vault + Managed Identity — voir [architecture.md](../architecture.md) §8.
- **GitHub** : variables d’environnement / secrets pour noms de ressources Azure (ACR, resource group, noms Container Apps), **pas** les mots de passe applicatifs.
- Connexion Actions → Azure : **federated credential (OIDC)**, rôle `AcrPush` + droits deploy sur le resource group cible.

### Module des comptes rendus (`VITE_CR_URL`)

Le module `cfao-comptes-rendus/` est servi à part du portail (son propre compose, ADR 0002). Le
portail y renvoie ses liens et les anciennes adresses `/portail/compte-rendu/*` par la variable
de build **`VITE_CR_URL`** (adresse publique du module, sans barre finale, par ex.
`https://comptes-rendus.example`). Sans elle le build de production utilise `http://localhost:8090`
(inutilisable hors du poste de dev) et affiche un avertissement, sans échouer. Si l'adresse a la
même origine et le même chemin que le portail, la redirection est suspendue (lien affiché) pour
éviter une boucle. Côté module : `ORIGINES_AUTORISEES`, `COOKIE_SECURE`, `ALLOWED_HOSTS` (voir
son README, « Exposer en interne »).

---

## 9. Checklist avant premier déploiement Azure

- [ ] ACR créé, scan vulnérabilités activé
- [ ] Container Apps (ou VM) + Postgres managé + Key Vault
- [ ] Identité managée user-assigned (pas system-assigned multi-conteneurs App Service — voir `architecture.md`)
- [ ] Dockerfile `frontend` + éventuellement `gateway`
- [ ] `cd.yml` + GitHub Environments `staging` / `production`
- [ ] Healthchecks post-deploy (`/healthz`, smoke stories `00-7`)
- [ ] Branch protection `main` + approbation prod

---

## 10. Références

- [architecture.md](../architecture.md) — topologie, Container Apps, Key Vault
- [BACKEND.md](../BACKEND.md) — Docker Compose local
- [SECURITY.md](../SECURITY.md) — pas de secrets dans Git
- [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits)
- [Azure Container Registry](https://learn.microsoft.com/azure/container-registry/)
- [Azure Container Apps](https://learn.microsoft.com/azure/container-apps/)
