---
name: devops-securite
description: Normes DevOps, sécurité et architecture applicative de CFAO Academy (Docker, compose, CI, Keycloak, Cerbos, edge, secrets, migrations) et quand déclencher les skills d'audit de sécurité. À utiliser pour toute modification de Dockerfile, compose, CI, auth, policy, proxy ou dépendance, et avant de livrer un changement qui touche l'infrastructure ou la sécurité.
---

# DevOps, sécurité, cloud agnostic : règles du dépôt

Sources de vérité : `AGENTS.md` (§6, §7), `RAIDER.md`, `docs/engineering/lessons-learned.md` (tableau de synthèse, à relire en premier).

## Principes
- **Cloud agnostic** : tout tourne en Docker Compose, standards ouverts (OIDC, OpenAPI, Postgres, nginx/Caddy). Aucun service managé propriétaire sans contrat de sortie.
- **Un seul point d'entrée** : Caddy (HTTPS) puis edge puis modules. Aucun module exposé en direct. Une route n'est publiée que si un client externe identifié en a besoin ; un relais multi-tenant nomme le tenant (liste blanche).
- **Default-deny** : Cerbos refuse sans règle. Jamais `roles: ["*"]` en lecture large. `roles` + `derivedRoles` = OU, pas ET.
- **Identité** : realm `cfao` unique. L'émetteur de jeton se compare à l'identique contre une liste déclarée. L'audience est produite par un mapper du realm. Le realm master n'est jamais exposé. Aucun compte de démo dans le realm de prod.
- **Secrets** : jamais dans le dépôt ni en clair dans un compose. `.env` local, modèles `.env.*.example` suivis par git. Scan de secrets (gitleaks) en CI.
- **Images** : utilisateur non root, base épinglée, fins de ligne LF (`.gitattributes`), image publiée = octets testés.
- **Base de données** : job `migrate` dédié dans le compose, no-op si à jour, jamais d'écrasement des données de prod (AGENTS.md §7). Idempotence garantie par une contrainte en base.
- **Contrats** : toute frontière inter-modules est déclarée dans `contracts/registry.json`, avec test fournisseur et consommateur.
- **Liens inter-modules** : déclarés dans les compose, jamais par `docker network connect` à la main.

## Preuve (jamais « c'est fait » sans)
- Tests réels : `pytest` dans le venv, `cerbos compile --tests`, typecheck, build. Pas seulement une syntaxe valide.
- Service compose : prouvé par une exécution observée, y compris le second démarrage (zéro écriture) et une base vide.
- Policy modifiée : redémarrer Cerbos, puis lire le droit avec un jeton réel.
- Après toute erreur ou near miss : entrée dans `lessons-learned.md` (cause racine, prévention vérifiable).

## Quand déclencher les skills d'audit (installés au niveau utilisateur)
| Situation | Skill |
|---|---|
| Revue d'une PR, d'un diff ou d'un commit touchant auth, policy, proxy, compose, CI | `differential-review` |
| Ajout ou mise à jour de dépendances, lockfile, nouvelle image de base | `supply-chain-risk-auditor` |
| Création ou modification d'un workflow `.github/workflows` | `agentic-actions-auditor` |
| Nouvelle configuration, nouvelle API interne, choix de valeurs par défaut | `sharp-edges` |
| Une faille est trouvée : chercher les autres du même type | `variant-analysis` |
| Audit d'un module peu connu avant de chercher des failles | `audit-context-building` |
| Bug, test rouge | `systematic-debugging` |
| Avant d'annoncer qu'un travail est terminé | `verification-before-completion` |

Ces skills produisent des constats : les relire avec le contexte du dépôt (les valeurs de recette 8088 sont des données de test) avant de les remonter.
