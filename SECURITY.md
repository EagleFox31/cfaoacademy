# Politique de sécurité — CFAO Academy

## Versions supportées

| Version | Support sécurité |
|---------|------------------|
| `main` / dernière release | ✅ Correctifs actifs |
| Branches `feature/*` | ❌ Pas de support direct — merger via PR vers `develop` / `main` |

## Signaler une vulnérabilité

**Ne pas** ouvrir d’issue publique pour une faille de sécurité.

1. Envoyer un email à **`security@cfao.com`** (remplacer par l’alias réel de votre organisation).
2. Objet suggéré : `[CFAO Academy — Security] Résumé court`.
3. Inclure si possible :
   - description et impact ;
   - étapes de reproduction ;
   - version / branche / commit ;
   - proposition de correctif (optionnel).

### Délais de réponse (objectifs internes)

| Étape | Délai visé |
|-------|------------|
| Accusé de réception | 2 jours ouvrés |
| Évaluation initiale | 5 jours ouvrés |
| Correctif ou plan d’action | selon criticité (CVSS) |

## Périmètre

Ce dépôt couvre notamment :

- `frontend/` — SPA vitrine et portail ;
- `cfao-core/` — API Django ;
- `cfao-operations/` — API Node ;
- `cerbos/` — policies d’autorisation ;
- `gateway/`, `keycloak/` — configuration infra locale ;
- pipelines CI (`.github/workflows/`).

Les dépendances tierces (Keycloak, Cerbos, Postgres, nginx) suivent leurs propres advisories ; les images Docker sont **épinglées** dans `docker-compose.yml` et doivent être mises à jour de façon contrôlée.

## Bonnes pratiques pour les contributeurs

- **Aucun secret** dans le code, l’historique Git ou les issues/PR (mots de passe, clés API, tokens JWT de prod).
- Utiliser `.env.example` comme référence ; en production : coffre de secrets (ex. Azure Key Vault — voir `architecture.md` §8).
- Chaque endpoint API doit passer par le **PEP Cerbos** (default-deny). Voir `BACKEND.md`.
- Les PR sont analysées par **Gitleaks** en CI.
- Activer **Dependabot** / revue des alertes GitHub sur ce dépôt.

## Configuration sécurité recommandée (organisation GitHub)

À activer au niveau org ou repo (responsable DevOps) :

- Branch protection sur `main` : PR obligatoire, revue CODEOWNERS, CI verte ;
- Secret scanning + **push protection** ;
- Dependabot alerts ;
- (Optionnel) CodeQL sur `frontend/`, `cfao-core/`, `cfao-operations/`.

## Divulgation coordonnée

Nous préférons une divulgation responsable : ne pas publier de détails avant qu’un correctif soit disponible sur les environnements exposés, sauf accord explicite de l’équipe sécurité CFAO.
