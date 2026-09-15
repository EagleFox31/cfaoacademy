# Walkthrough — journal de tests & validation

Trace honnête de ce qui a été **réellement exécuté** (pas seulement écrit), les erreurs
rencontrées, les correctifs, et le **périmètre couvert / non couvert** à chaque étape.

Convention de chaque fiche :
**Contexte → État avant → Tests exécutés → Erreurs rencontrées → Modifications → Résultat final → Périmètre couvert / non couvert.**

| Fiche | Sujet | Verdict |
|-------|-------|---------|
| [01-noeud-A-tests.md](01-noeud-A-tests.md) | Nœud A : policies Cerbos, pytest core, build Node | ✅ vert (2 bugs corrigés) |
| [02-usine-generateur.md](02-usine-generateur.md) | Usine : génération réelle d'un module → tests | ✅ vert (1 bug corrigé) |
| [03-stack-live.md](03-stack-live.md) | Stack `docker compose` : auth bout-en-bout live | ✅ 200/401 (5 bugs corrigés) |
| [04-operateur-query-plan.md](04-operateur-query-plan.md) | Opérateur `scopeNode ∈ org_path` (TDD) — prérequis de B | ✅ 8/8 + AST confirmé live |
| [B-identity-plan.md](B-identity-plan.md) | **Plan du nœud B (Identity)** — tests d'abord, puis build | 📋 plan |
| [05-noeud-B-increment1.md](05-noeud-B-increment1.md) | B · incrément 1 : modèle org + `resolve_principal` (TDD) | ✅ 7/7 (18/18 total) |
| [06-noeud-B-increment2.md](06-noeud-B-increment2.md) | B · incrément 2 : endpoints /org/units scopés (TDD) | ✅ 24/24 + Cerbos 14/14 |
| [07-noeud-B-increment3.md](07-noeud-B-increment3.md) | B · incrément 3 : /me v2 + seed + validation LIVE | ✅ 26/26 + live identity/Postgres |
| [08-noeud-B-increment4.md](08-noeud-B-increment4.md) | B · incrément 4 : endpoints /users scopés (TDD + live) | ✅ 32/32 + Cerbos 21/21 + live |
| [09-noeud-B-increment5.md](09-noeud-B-increment5.md) | B · incrément 5 : assignments + recompute auto (TDD + live) | ✅ 36/36 + Cerbos 26/26 + live |
| [10-noeud-B-increment6-multiscope.md](10-noeud-B-increment6-multiscope.md) | B · incrément 6 : **multi-scope** (TDD + live) | ✅ 38/38 + Cerbos 28/28 + live |
| [11-noeud-B-cloture.md](11-noeud-B-cloture.md) | B · clôture socle (DELETE affectation + bilan) | ✅ 40/40 + Cerbos 28/28 |
| [12-audit-12-4.md](12-audit-12-4.md) | Gouvernance · journal d'**audit** (12-4) | ✅ 46/46 + Cerbos 33/33 + live |
| [13-noeud-D-increment1-catalogue.md](13-noeud-D-increment1-catalogue.md) | D (LMS) · incrément 1 : **catalogue** (TDD + live) | ✅ 53/53 + Cerbos 54/54 + live |
| [14-noeud-D-increment2-enrollment.md](14-noeud-D-increment2-enrollment.md) | D (LMS) · incrément 2 : **inscription + progression** (TDD + live) | ✅ 59/59 + Cerbos 62/62 + live |

Environnement de test : Python 3.13 (venv `cfao-core/.venv`), Node 24, Docker 29 + Compose v5.
Normes appliquées : voir mémoire DevSecOps + `planning.md §6` (séquence TU → TI → contrat → E2E).
