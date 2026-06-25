# Plan — Nœud B (Identity)

> **Tests d'abord** (TDD / pyramide `planning.md §6`), puis build. B est le **socle d'autorisation**
> (la source de vérité du périmètre) → exigence de couverture la plus élevée + tests négatifs systématiques.

## Périmètre fonctionnel (epics 11 + 12, + T-2)
- **Arbre org** : `Group → Region → Branch → Agency` + `Department` + `Brand` (marques par département).
- **Comptes** : `User` (lié au `sub` Keycloak) ; `RoleAssignment` (rôle + `scopeNode` + départements + marques) — **cumulables**.
- **Provisioning Keycloak** (création compte, rôles, attributs) via Admin API.
- **`/me` v2** : **résolution du scope côté service** depuis les `RoleAssignment` (et non plus la simple lecture des claims) — c'est l'évolution clé.
- Stories : `11-1..5`, `12-1..5`, `T-2` (résolution du périmètre 3D).

---

## 1. Plan de tests (à écrire AVANT le code)

### ① Tests unitaires (TU) — `pytest`, isolés
- **Modèles** : calcul de `org_path` (dénormalisation parent→enfant) ; unicité ; `Department`↔`Brand` (M2M).
- **Règle métier Equipment** : refuser une affectation marque PL/engins/chariots/bus sur un département ≠ `equipment` (PLATFORM_ROLES.md).
- **Résolution de scope** : `resolve_principal(user)` = **union** des affectations actives (org × dépt × marque) ; multi-affectations.
- **Client provisioning Keycloak** (HTTP mocké) : payloads create-user / role-mapping / set-attributes corrects.
- **Policies Cerbos** (`cerbos compile --tests`) : `account`, `branch`, `agency`, `department`, `brand` — view/list/create/update scopé **+ négatifs hors-périmètre**.

### ② Tests d'intégration (TI) — DRF + DB de test
- CRUD `/org/branches` `/org/agencies` `/org/departments` `/org/brands` : admin **dans** son scope → OK ; **hors** scope → 403 / liste filtrée.
- `/users` CRUD ; `POST /users/{id}/assignments` (rôle + scope + marques).
- `/me` : reflète le scope **résolu en base** (pas seulement le token) ; union de 2 affectations.
- **Signal `org_restructured`** émis lors d'une réorg (recalcul `org_path`).
- Filtrage de liste par **query plan** Cerbos (⚠️ dépendance : opérateur `scopeNode ∈ org_path`, cf. §3).

### ③ Tests de contrat
- **Provisioning Keycloak** : contrat du payload Admin API (snapshot / mock vérifié).
- **Événement `candidate_hired`** (consommé par identity → crée le compte) : schéma du payload (avec `recruitment`, plus tard).
- **Événement `org_restructured`** (émis → ops, analytics) : schéma.
- **OpenAPI** `/api/v1/core/org/*`, `/users/*`.

### ④ Tests E2E (Playwright, stack Compose)
- Admin groupe crée Région→Filiale→Agence→Département→Marque → crée un user + affectation → provisioning Keycloak → le user **se connecte (SSO)** → `/me` reflète son scope → accède à une ressource **de son périmètre (200)** et est **refusé hors périmètre (403)**.
- **Smoke `00-7`** : 1 compte par rôle clé → login + `/me` (étend la validation déjà amorcée sur 2/9 users).

### Tests négatifs / sécurité **obligatoires** (OWASP A01 / ASVS L2)
- `branch_admin` : pas de create/view **hors** de sa filiale.
- `learner` : ne peut **ni** créer un compte **ni** une org (403).
- **IDOR** : `GET /users/{id}` d'un autre périmètre → 403.
- **Élévation de privilège** : un user ne peut pas modifier **son propre** rôle/scope.
- **Règle Equipment** : affectation PL/engins sur département non-Equipment → refus.

### Definition of Done & couverture
- Pyramide ~**70 % TU / 20 % TI / 10 % E2E** ; contrat dès qu'une frontière (Keycloak, événements) est touchée.
- DoD par story : code + revue · TU verts · TI verts · contrat si frontière · E2E si parcours · doc API/événement à jour.
- Cible : **ASVS L2** ; couverture élevée sur les services critiques (résolution de scope, provisioning).
- CI : la suite s'ajoute aux jobs existants (cerbos / pytest / node / secret-scan) ; ajouter **SAST + SCA** (shift-left).

---

## 2. Plan de build (après rédaction des tests rouges)
1. **Modèles + migrations** : `Group, Region, Branch, Agency, Department, Brand, User, RoleAssignment`.
2. **Services** : dénormalisation `org_path` · `resolve_principal()` (union des affectations) · **client Keycloak Admin** (provisioning idempotent) · émission `org_restructured`.
3. **`/me` v2** : bascule de « claims du token » → **résolution côté service** (avec cache), conformément à architecture.md §6.
4. **Policies Cerbos** : `branch/agency/department/brand` (réutiliser `admin_within_scope`) + maj `account`.
5. **Endpoints** : viewsets **générés via l'usine** (`new_module.py`) puis étoffés (logique arbre org, assignments).
6. **Seed dev** : matérialiser en base les **9 personas** déjà dans le realm Keycloak.

## 3. Dépendances & risques
- **🔴 Bloquant : opérateur de query plan `scopeNode ∈ org_path`** (`core/authz/filters.py`, aujourd'hui partiel/fail-closed). Nécessaire au filtrage de liste scopé des endpoints org/users. → **story à livrer avant/pendant B** (relève de C/Authz). Sans lui, les listes scopées renvoient vide.
- **Provisioning Keycloak** : idempotence + rollback (compte créé mais affectation échouée).
- **Source de vérité du scope** : décider et tester la cohérence token vs base (on résout en base ; le token ne sert qu'à l'identité). Invalidation du cache à la réorg.
- **Dépend de A** (fait) : Keycloak, Cerbos, couche `core/`, l'usine.

## 4. Hors périmètre B (différé)
Recrutement (G), LMS (D), notifications (I), analytics (H), BFF oauth2-proxy complet, bus d'événements (webhooks directs au départ).
