# 06 — Nœud B · incrément 2 : endpoints /org/units scopés (TDD)

## Contexte
Exposer l'arbre org en API **scopée par périmètre**, avec **tests négatifs d'autorisation**.

## État avant
- Modèles org + `resolve_principal` (inc.1). Aucun endpoint org. PEP `CerbosPermission` faisait
  un check « collection » même pour les actions de détail.

## Tests exécutés (écrits AVANT)
```bash
cd cfao-core && .venv/Scripts/python -m pytest identity/tests/test_org_endpoints.py -q
.venv/Scripts/python -m pytest -q                 # non-régression
docker run ... cerbos compile --tests=/work/tests /work/policies   # policy org_unit
```
Cas : liste anonyme refusée ; liste filtrée par query plan (allowed→3, denied→vide) ; retrieve
in-scope→200 ; **retrieve hors-scope→403 (négatif)** ; **create par un learner→403 (négatif/élévation)**.
Côté Cerbos : admin view/update in-scope ALLOW ; **hors-scope DENY** ; **learner update/create/delete DENY**.

## Erreurs rencontrées
- **Rouge attendu** : endpoints 404, policy `org_unit` absente → positifs en DENY.
- **Bug de conception trouvé** : le PEP refaisait un check « collection » (ressource fictive sans
  `orgPath`) pour les actions de **détail** → faux refus en Cerbos réel sur un retrieve pourtant in-scope.

## Modifications
- `core/authz/permissions.py` : `has_permission` **défère** `retrieve/update/destroy` (et `list`)
  → l'enforcement précis se fait dans `has_object_permission` (objet réel) / le query plan (liste).
  Correctif transverse : bénéficie aussi aux modules générés par l'usine.
- `cerbos/policies/resource_policies/org_unit.yaml` (+ `cerbos/tests/org_unit_test.yaml`).
- `identity/serializers.py` (`OrgUnitSerializer`), `identity/views.py` (`OrgUnitViewSet` :
  objet via `get_cerbos_object`, création via périmètre du parent, liste via query plan sur `path`),
  `identity/urls.py` (route `org/units`).

## Résultat final
- **pytest 24 passed** (18 + 6) ; **Cerbos 14 OK** (7 account + 7 org_unit). Aucune régression.

## Périmètre couvert
- CRUD `/org/units` : PEP default-deny, **objet** (retrieve/update/destroy) via Cerbos sur l'objet réel,
  **liste** filtrée par query plan, **création** contrôlée contre le périmètre du parent.
- Négatifs : hors-scope (403), élévation learner (403) — côté Django (mock) **et** policy Cerbos (réel).

## Périmètre NON couvert (→ inc.3)
- **`/users` + `/users/{id}/assignments`** (scope via jointure sur les affectations — plus complexe).
- **`/me` v2** : brancher `resolve_principal()` (DB) à la place des claims.
- **Multi-scope** : principal à `scopeNodes` pluriel + policy `exists s in scopeNodes : s in orgPath`.
- **Live** : rebuild `core` + migration appliquée + **seed** des 9 personas + **TI Postgres** du `path__contains` + **E2E**.
