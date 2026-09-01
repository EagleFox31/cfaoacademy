# Brique transverse — Delivery & Déploiement continu

## Statut

Proposition d’architecture.

Cette brique complète la chaîne existante d’intégration continue de CFAO Academy. Elle ne correspond pas à une application métier : elle fournit le mécanisme transverse permettant de valider, intégrer, livrer et déployer les évolutions de la plateforme de manière reproductible et contrôlée.

---

## 1. Objectif

Automatiser le passage d’une modification validée jusqu’à l’environnement cible, tout en conservant les garanties suivantes :

- aucune intégration dans `main` tant que les contrôles obligatoires ne sont pas verts ;
- aucun déploiement d’un artefact non testé ;
- traçabilité de chaque livraison ;
- déploiement reproductible ;
- vérification automatique après mise en ligne ;
- possibilité de revenir rapidement à la version précédente en cas d’échec.

Le flux cible est :

```text
feature/*
   ↓
Pull Request
   ↓
CI
├── tests backend
├── tests frontend
├── build
├── policies Cerbos
└── secret scanning
   ↓
Tous les checks obligatoires sont verts
   ↓
Auto-merge vers main
   ↓
Build des artefacts / images Docker
   ↓
Publication dans le registry
   ↓
Déploiement
   ↓
Health checks / smoke tests
   ↓
Succès ───────────────► version active
   │
   └── échec ─────────► rollback
```

---

## 2. Périmètre

### 2.1 Intégration continue

La CI existante reste la porte d’entrée obligatoire avant intégration.

Contrôles attendus selon les composants modifiés :

- `cfao-core` : installation des dépendances et `pytest` ;
- `cfao-operations` : typecheck, tests et build ;
- `frontend` : installation propre et build Vite ;
- `cfao-needs/api` : `pytest` ;
- `cfao-needs/web` : build Vite ;
- Cerbos : compilation des policies et exécution des tests positifs/négatifs ;
- sécurité : secret scanning ;
- à terme : lint, SAST, dependency scanning et tests E2E ciblés.

Une PR ne doit pas pouvoir être intégrée si un contrôle obligatoire est en échec.

---

## 3. Auto-merge

L’automatisation recommandée n’est pas un push direct vers `main`.

Le workflow cible est :

1. le développeur pousse sur une branche de feature ;
2. une Pull Request est ouverte vers `main` ;
3. la CI s’exécute ;
4. GitHub attend la réussite de tous les checks requis ;
5. l’auto-merge fusionne la PR ;
6. le pipeline de delivery démarre depuis le commit effectivement présent sur `main`.

Cette règle permet de conserver l’historique, la review, les contrôles de sécurité et la possibilité d’annuler une intégration avant qu’elle n’atteigne la branche de référence.

### Pré-requis GitHub

- protection ou ruleset sur `main` ;
- Pull Request obligatoire ;
- checks CI requis ;
- branche à jour avant merge si nécessaire ;
- auto-merge activé ;
- suppression automatique de la branche après merge recommandée.

---

## 4. Continuous Delivery

Après chaque merge sur `main`, le pipeline produit des artefacts immuables.

### 4.1 Build

Construire uniquement les composants nécessaires au déploiement :

- image `cfao-core` ;
- image `cfao-operations` ;
- image du frontend ou bundle statique selon le mode retenu ;
- images du module `cfao-needs` si celui-ci est déployé séparément ;
- configuration Nginx / gateway versionnée.

Chaque artefact doit être identifiable par le SHA Git du commit source.

Exemple :

```text
ghcr.io/<org>/cfao-core:53bae25
ghcr.io/<org>/cfao-operations:53bae25
ghcr.io/<org>/cfao-needs-api:53bae25
```

Le tag `latest` peut exister pour la commodité mais ne doit pas être la seule référence utilisée lors d’un déploiement ou d’un rollback.

---

## 5. Registry

Les images construites par la CI/CD sont publiées dans un registry Docker :

- GHCR ;
- Docker Hub ;
- ou registry privé CFAO si disponible ultérieurement.

Le serveur de production ne construit pas le code source. Il récupère des images déjà construites et testées par la pipeline.

Cela garantit que l’artefact testé est exactement celui qui est déployé.

---

## 6. Déploiement serveur

Le déploiement peut être déclenché automatiquement après publication des artefacts.

Flux cible sur le serveur :

```bash
docker compose pull
docker compose up -d --remove-orphans
```

Le mécanisme réel peut être implémenté par :

- GitHub Actions avec accès SSH restreint ;
- un runner GitHub auto-hébergé sur l’infrastructure CFAO ;
- un webhook de déploiement contrôlé ;
- un outil de déploiement dédié si l’infrastructure évolue.

Le choix devra respecter les contraintes de sécurité réseau CFAO.

---

## 7. Déploiement progressif recommandé

Pour éviter qu’un merge dans `main` ne devienne immédiatement une modification visible en production, la cible recommandée est :

```text
PR
 ↓
CI
 ↓
main
 ↓
Staging automatique
 ↓
Smoke tests
 ↓
Validation production
 ↓
Production
```

### Phase initiale

Tant qu’un environnement de staging séparé n’est pas disponible :

- le build et la publication des images peuvent être entièrement automatiques ;
- le déploiement production peut conserver une approbation manuelle via un GitHub Environment.

### Phase mature

Lorsque l’environnement est suffisamment fiabilisé :

- staging automatique ;
- tests automatiques post-déploiement ;
- production automatique ou semi-automatique selon la politique CFAO.

---

## 8. Health checks et smoke tests

Un déploiement n’est pas considéré comme réussi simplement parce que les conteneurs sont démarrés.

Le pipeline doit vérifier au minimum :

- disponibilité du gateway ;
- endpoint `/health` ou équivalent des APIs ;
- connexion aux dépendances essentielles ;
- disponibilité du frontend ;
- test d’une requête applicative non destructive ;
- état des conteneurs Docker.

Exemple conceptuel :

```bash
curl --fail https://academy.example/health
curl --fail https://academy.example/api/v1/health
```

Une sonde en échec doit faire échouer le job de déploiement.

---

## 9. Rollback

Chaque déploiement doit conserver la version précédente identifiable.

En cas d’échec des smoke tests ou d’incident immédiatement après livraison :

1. identifier le dernier SHA connu comme stable ;
2. restaurer les images correspondantes ;
3. relancer `docker compose up -d` ;
4. exécuter à nouveau les health checks ;
5. journaliser le rollback.

Le rollback applicatif ne doit pas être confondu avec le rollback de base de données. Les migrations destructives doivent être évitées ou être livrées selon une stratégie compatible avec deux versions successives de l’application.

---

## 10. Migrations de base de données

Principe : **expand → migrate → contract**.

Une livraison ne doit pas supposer qu’un rollback de schéma est toujours possible.

Exemples :

- ajouter une colonne avant que l’application ne commence à l’utiliser ;
- déployer le code compatible avec ancien et nouveau schéma ;
- migrer les données ;
- supprimer l’ancien champ dans une livraison ultérieure.

Les migrations doivent être exécutées une seule fois par déploiement, avant la bascule complète du trafic lorsque nécessaire.

---

## 11. Sécurité

La brique Delivery doit appliquer le principe du moindre privilège.

### GitHub Actions

- déclarer explicitement les permissions nécessaires ;
- ne pas utiliser `write-all` ;
- isoler les permissions de publication et de déploiement dans leurs jobs respectifs ;
- protéger les secrets de production par GitHub Environments ;
- éviter d’exposer les secrets aux workflows issus de forks.

### Serveur

- compte de déploiement dédié ;
- clé SSH dédiée et révocable ;
- permissions limitées au répertoire / service concerné ;
- aucun mot de passe de production stocké dans le dépôt ;
- secrets injectés côté serveur ou via le mécanisme de secrets retenu.

---

## 12. Traçabilité

Chaque déploiement doit permettre de retrouver :

- le commit source ;
- la Pull Request ;
- l’auteur ;
- les checks CI associés ;
- les images utilisées ;
- l’environnement cible ;
- la date du déploiement ;
- le résultat des smoke tests ;
- un éventuel rollback.

Le SHA Git constitue l’identifiant principal de corrélation entre code, image et déploiement.

---

## 13. Workflows GitHub cibles

Découpage recommandé :

```text
.github/workflows/
├── ci.yml
├── release.yml
├── build-images.yml
├── deploy-staging.yml
└── deploy-production.yml
```

`ci.yml` reste responsable de la qualité du code.

`build-images.yml` transforme un commit validé de `main` en artefacts déployables.

`deploy-staging.yml` déploie automatiquement les artefacts en environnement de validation.

`deploy-production.yml` assure la promotion vers production avec les contrôles nécessaires.

---

## 14. Critères d’acceptation de la brique

La brique est considérée comme opérationnelle lorsque :

- [ ] `main` est protégée et les PR sont obligatoires ;
- [ ] les checks CI requis bloquent le merge en cas d’échec ;
- [ ] l’auto-merge peut fusionner une PR après réussite des checks ;
- [ ] un merge dans `main` construit des images versionnées par SHA ;
- [ ] les images sont publiées dans un registry ;
- [ ] le déploiement utilise ces images sans rebuild sur le serveur ;
- [ ] les migrations sont exécutées de manière contrôlée ;
- [ ] des health checks / smoke tests valident la mise en ligne ;
- [ ] un rollback vers le dernier SHA stable est documenté et testé ;
- [ ] les secrets de production ne sont pas stockés dans Git ;
- [ ] chaque déploiement est traçable jusqu’à sa PR et son commit.

---

## 15. Ordre d’implémentation

### Étape 1 — sécuriser l’intégration

- ruleset `main` ;
- checks CI obligatoires ;
- auto-merge ;
- suppression automatique des branches fusionnées.

### Étape 2 — produire les artefacts

- Dockerfiles de production ;
- build depuis `main` ;
- tags par SHA ;
- publication registry.

### Étape 3 — automatiser le serveur

- accès de déploiement dédié ;
- `docker compose pull` ;
- `docker compose up -d` ;
- migrations ;
- health checks.

### Étape 4 — fiabiliser la livraison

- staging ;
- smoke tests ;
- GitHub Environments ;
- approbation production si requise ;
- rollback automatisé ou semi-automatisé.

---

## 16. Hors périmètre initial

Ne sont pas nécessaires pour la première version :

- Kubernetes ;
- service mesh ;
- déploiement multi-région ;
- canary deployment sophistiqué ;
- GitOps complet ;
- orchestration de microservices avancée.

Le besoin actuel peut être couvert proprement avec GitHub Actions, un registry Docker, Docker Compose et des procédures de rollback simples et testées.
