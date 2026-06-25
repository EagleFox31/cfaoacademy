# 11 — Nœud B (Identity) · clôture

## Dernier ajout : DELETE d'une affectation
- `DELETE /api/v1/core/assignments/{id}` (TDD) — contrôlé contre le périmètre de l'unité ciblée
  (policy `role_assignment`), recompute `scope_paths` automatique (signal `post_delete`).
- Tests : in-scope → 204 + recompute ; hors-scope → 403. **pytest 40 passed.**

## Bilan B — ce qui est livré et testé
| Brique | Tests |
|--------|-------|
| Modèle org (arbre, `org_path`), `Brand`, `Department` (règle Equipment) | unitaire |
| `resolve_principal` (union des affectations) | unitaire |
| `/me` v2 (périmètre résolu en base) | unitaire **+ live** |
| `/org/units` scopés (query plan) | unitaire + Cerbos **+ live** |
| `/users` scopés (`scope_paths` dénormalisé) | unitaire + Cerbos **+ live** |
| Affectations : POST + DELETE + recompute auto (signal) | unitaire + Cerbos **+ live** |
| **Multi-scope** (`exists`, principal multi-`scopeNodes`) | unitaire + Cerbos **+ live** |

**Totaux : pytest 40 · Cerbos 28 · validations live OK.** Sécurité : default-deny, fail-closed,
tests négatifs systématiques (hors-scope, IDOR, élévation de privilège, règle Equipment).

## Différé (hors clôture — finitions / autres nœuds)
- **Cache** de la résolution DB côté auth (1 requête par requête aujourd'hui).
- **Départements** dans le seed (les affectations n'y sont pas reliées → `/me departments` vide).
- **Provisioning à la première connexion** (créer/lier le compte au login plutôt que par seed).
- **Tests de contrat** Keycloak (provisioning) et **E2E Playwright** — nécessitent de câbler la SPA
  au BFF (la vitrine React utilise encore des mocks) → relève d'un nœud frontend, pas de B.
