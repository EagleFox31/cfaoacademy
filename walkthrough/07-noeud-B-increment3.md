# 07 — Nœud B · incrément 3 : /me v2 + seed + validation LIVE

## Contexte
Brancher la **résolution de périmètre côté service** (`/me` v2) et la valider **en live** sur
de vraies données (seed des 9 personas), dont le filtre de liste sur Postgres réel.

## État avant
- `resolve_principal` (inc.1) et endpoints `/org/units` (inc.2) testés en unitaire/policy.
- `/me` lisait encore les claims du token. Pas de données en base. Filtre `path__contains`
  non encore exécuté sur Postgres (SQLite only).

## Tests exécutés
```bash
# Unitaire (TDD /me v2)
.venv/Scripts/python -m pytest -q          # 26 passed
# Live
docker compose down -v && docker compose up -d --build
docker compose up keycloak-config-cli       # realm importé
docker compose exec core python manage.py seed_dev
# token réel (cfao-spa) → /me + /org/units via gateway
```

## Erreurs rencontrées
1. **Courses de healthcheck au démarrage à froid** : recreate simultané de tous les conteneurs
   → faux « cerbos/operations unhealthy » (gateway pas démarré). Résolu par un second `up -d`
   (les images sont déjà construites → démarrage rapide, healthchecks passent).
2. **Keycloak n'honore pas l'`id` fixe** fourni à la création via config-cli → il génère son
   propre `sub`. Le seed à UUID fixe ne matchait donc pas le token → `/me` repartait sur le token.
   **Fix** : le seed récupère le **vrai `sub`** par username via l'**API admin Keycloak**
   (fallback UUID fixe si Keycloak injoignable) ; reset des tables identity pour rester idempotent.

## Modifications
- `identity/views.py` : `MeView` v2 — si le compte existe en base, renvoie `resolve_principal()`
  (`source: identity`) ; sinon repli sur les claims (`source: token`).
- `identity/management/commands/seed_dev.py` : seed idempotent (org tree, marques, 9 personas,
  affectations) + résolution du `sub` réel via API admin Keycloak.
- `docker-compose.yml` : env Keycloak (URL/admin) ajouté à `core` (dev) pour le seed.
- Tests : `test_me_v2_resolu_depuis_la_base`, `test_me_v2_repli_sur_claims_si_inconnu`.

## Résultat final
- **Unitaire** : **26 passed**.
- **Live `/me`** (token réel) :
  - `aminata.kone` → `source: identity`, `roles: [branch_hr]`, `scopeNodes: [groupe.afrique_ouest.cote_divoire]` ;
  - `loic.traore` → `source: identity`, `roles: [learner]`, `brands: [fuso, jcb, king-long, lovol, renault-trucks]`.
- **Live `/org/units`** (aminata, branch_hr) → **HTTP 200, 2 unités** : `cote_divoire` + `abidjan_plateau`
  → **filtre `path__contains` validé sur Postgres réel** (le TI qui restait).

## Périmètre couvert
- `/me` v2 **résolu en base** depuis les affectations (source de vérité) — **prouvé live**.
- **Seed** reproductible des 9 personas, alignés au realm, avec vrais `sub`.
- **Filtrage de liste scopé sur Postgres réel** (query plan → `path__contains`) — **prouvé live**.

## Périmètre NON couvert (→ suite)
- **`/users` + `/users/{id}/assignments`** (scope par jointure affectations).
- **Multi-scope** : principal `scopeNodes` pluriel + policy `exists s in scopeNodes : s in orgPath`
  (les checks Cerbos utilisent encore le `scopeNode` singulier du token).
- **Départements** non seedés (affectations sans `departments` → `departments: []` dans `/me`).
- **Provisioning à la première connexion** (créer/lier le compte au login) — ici on seed manuellement.
- **Contrat** provisioning Keycloak, **E2E** Playbook complet.
