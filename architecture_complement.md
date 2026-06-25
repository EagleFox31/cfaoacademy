# CFAO Academy — Compléments techniques

Complément à `ARCHITECTURE.md`. Couvre les points soulevés en revue : mécanisme de scope, schéma `identity`, principal Cerbos, policy concrète, auth SPA (pattern BFF), dev local, sauvegardes, attribution de droits par personne, CMS.

---

## 1. Mécanisme de scope : `scopeNode ∈ orgPath`

### Le principe

Chaque **ressource** porte la liste de ses ancêtres org (du groupe jusqu'à son agence). Chaque **utilisateur** porte un (ou quelques) nœud(s) de scope. Être « dans le périmètre » = le nœud de l'utilisateur figure dans le chemin de la ressource.

- Ressource : `orgPath = ["grp_cfao", "reg_ca", "br_cmr", "ag_douala"]`
- KI filiale Cameroun : `scopeNode = "br_cmr"` → présent dans `orgPath` ✓
- Directeur régional : `scopeNode = "reg_ca"` → présent ✓ (couvre toute la région)
- Directeur groupe : `scopeNode = "grp_cfao"` → présent dans **tout** orgPath ✓

Ce n'est **pas** un `startsWith` sur une chaîne — c'est un test d'appartenance à une liste, donc exact par segment, sans ambiguïté de préfixe.

### La dualité de représentation (le point clé)

Le même périmètre s'exprime de deux façons selon le consommateur :

| Consommateur | Représentation | Test |
|--------------|----------------|------|
| **Cerbos** (décision sur 1 ressource) | `orgPath` = liste d'IDs | CEL : `scopeNode in orgPath` |
| **PostgreSQL** (query plan → filtre liste) | `path` = colonne indexable | `path @> :scope` (ltree) ou `:scope = ANY(org_path)` (array) |

On stocke le chemin **une fois** sur l'arbre org, et il alimente les deux mondes. Le query plan Cerbos (`plan_resources`) renvoie la condition `scopeNode in orgPath` ; le traducteur (`core/authz/filters.py`) la convertit en clause SQL via `ltree`/array — jamais de filtrage ligne par ligne en mémoire.

### Stockage recommandé : `ltree`

```sql
CREATE EXTENSION IF NOT EXISTS ltree;
-- path stocké sur l'arbre org, ex : 'grp_cfao.reg_ca.br_cmr.ag_douala'
-- "scope_path est un ancêtre-ou-soi de resource_path" :
--   WHERE :scope_path @> resource.org_path
CREATE INDEX idx_org_path ON org_node USING GIST (path);
```

Alternative plus simple si tu veux éviter `ltree` : une colonne `org_path text[]` dénormalisée sur chaque ressource + index GIN, filtrée par `:scope = ANY(org_path)`. L'`org_path` est recopié au moment de l'écriture depuis le nœud de rattachement (l'arbre org bouge rarement ; en cas de réorganisation, on recalcule par batch).

Le `path` se maintient par **trigger** (recalcul à l'insertion ou au déplacement d'un nœud), géré via **django-pgtrigger** : le trigger est défini en Python sur le modèle, versionné et installé par migration, donc testable — pas de `RunSQL` brut à la main.

### Traduire le query plan côté Django (pas d'adaptateur officiel)

Point d'attention important : Cerbos fournit des adaptateurs de query plan pour SQLAlchemy, Prisma, Drizzle, Mongoose, etc. — **mais pas pour Django ORM**. `core/authz/filters.py` est donc du code maison : tu parses l'AST du plan (opérateurs `and / or / not / eq / ne / lt / gt / le / ge / in`) vers des objets `Q`, en t'inspirant de l'adaptateur SQLAlchemy comme blueprint.

Cas limite à anticiper : `scopeNode in orgPath` est un *scalaire dans un attribut-liste de la ressource*. Le `in` des adaptateurs vise « attribut dans une liste de constantes » ; pour le cas tableau, prévois un **opérateur custom** émettant `:scope = ANY(org_path)` (Cerbos permet d'attacher des opérateurs custom au plan). Faisable, mais pas gratuit — chiffre ce travail dans ton planning.

### Réorganisation : tenir l'orgPath cohérent

Le piège : si une filiale est déplacée (ex. rattachée à une autre région), tout `orgPath` **dénormalisé** sur des ressources devient faux. Trois niveaux de réponse, du plus sûr au plus optimisé :

1. **Ne pas dénormaliser dans `core`.** La ressource porte un FK `org_node_id`, et on lit le path en joignant `org_node` (ou via `ltree` directement sur le nœud). Le trigger qui maintient `org_node.path` corrige alors *tout le monde gratuitement* : aucune copie à invalider. C'est le défaut recommandé.
2. **Dénormaliser comme optimisation** uniquement si la jointure devient un coût mesuré. Tu acceptes alors de devoir recalculer les copies lors d'une réorg.
3. **Propager au-delà du service.** `operations` (autre DB) ne peut pas joindre `org_node` ; il garde sa propre copie de `org_node_id` (+ éventuellement un path caché). Seule façon de le corriger lors d'une réorg : un événement **`org_restructured`** publié par `core` → `operations` et les read models `analytics` recalculent leurs ressources affectées.

Point clé : une réorganisation est **rare** (quelques fois par an). Donc même la propagation inter-services se fait par un **batch de recalcul** déclenché par l'événement, pas en temps réel. Tu ne paies ce coût qu'aux rares moments où l'arbre bouge.

---

## 2. Schéma PostgreSQL — module `identity`

Arbre org **unifié** (un seul table auto-référencée) plutôt que 4 tables séparées : ça rend `scopeNode`/`orgPath` triviaux et la hiérarchie homogène.

```sql
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE TYPE org_level AS ENUM ('group', 'region', 'branch', 'agency');

-- Arbre organisationnel (groupe → région → filiale → agence)
CREATE TABLE org_node (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   uuid REFERENCES org_node(id),
    level       org_level NOT NULL,
    code        text UNIQUE NOT NULL,        -- 'br_cmr', 'ag_douala'…
    name        text NOT NULL,
    path        ltree NOT NULL,              -- 'grp_cfao.reg_ca.br_cmr.ag_douala'
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_node_path ON org_node USING GIST (path);

-- Départements (rattachés à une filiale ; varient selon la filiale)
CREATE TABLE department (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES org_node(id),
    code      text NOT NULL,                 -- 'motors' | 'equipment'
    name      text NOT NULL
);

-- Marques (référentiel global)
CREATE TABLE brand (
    id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,               -- 'toyota','suzuki','sinotruk'…
    name text NOT NULL
);

-- Marques couvertes par un département
-- (règle métier : PL/engins/chariots/bus → toujours un département 'equipment')
CREATE TABLE department_brand (
    department_id uuid REFERENCES department(id),
    brand_id      uuid REFERENCES brand(id),
    PRIMARY KEY (department_id, brand_id)
);

-- Utilisateurs (Keycloak possède l'authentification : aucun mot de passe ici)
CREATE TABLE app_user (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id text UNIQUE NOT NULL,        -- 'sub' du token
    email       text UNIQUE NOT NULL,
    full_name   text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Affectation = rôle + périmètre (les 3 dimensions du scope)
CREATE TABLE role_assignment (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES app_user(id),
    role          text NOT NULL,             -- 'ki','workshop_manager','branch_director'…
    scope_node_id uuid NOT NULL REFERENCES org_node(id),  -- dimension ORG
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assignment_department (        -- dimension DÉPARTEMENT
    assignment_id uuid REFERENCES role_assignment(id),
    department_id uuid REFERENCES department(id),
    PRIMARY KEY (assignment_id, department_id)
);

CREATE TABLE assignment_brand (             -- dimension MARQUE
    assignment_id uuid REFERENCES role_assignment(id),
    brand_id      uuid REFERENCES brand(id),
    PRIMARY KEY (assignment_id, brand_id)
);
```

**Cas multi-affectation.** Un utilisateur peut avoir plusieurs `role_assignment` (ex. KI Toyota agence X *et* learner). Le cas courant = une affectation effective → un `scopeNode`. Pour les profils vraiment multi-périmètres (formateur flottant), on passe une **liste** `scopeNodes` au principal et la policy teste `orgPath.exists(n, n in principal.scopeNodes)`. On démarre sur le cas simple ; la liste est l'extension documentée.

---

## 3. Le principal Cerbos (3 dimensions)

Construit à chaque requête depuis le token + le module `identity` (cf. `core/auth/principal.py`).

```json
{
  "id": "u_123",
  "roles": ["ki"],
  "attr": {
    "scopeNode": "br_cmr",          // dimension ORG (nœud de périmètre)
    "departments": ["motors"],      // dimension DÉPARTEMENT
    "brands": ["toyota"]            // dimension MARQUE (marque certifiée du KI)
  }
}
```

La ressource correspondante (une évaluation sur un apprenant Toyota à Douala) :

```json
{
  "kind": "evaluation",
  "id": "ev_789",
  "attr": {
    "orgPath": ["grp_cfao", "reg_ca", "br_cmr", "ag_douala"],
    "department": "motors",
    "brand": "toyota"
  }
}
```

---

## 4. Policy Cerbos concrète — `evaluation.yaml` (cas KI/PIC)

```yaml
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  resource: evaluation        # une évaluation / compétence saisie sur un apprenant
  version: default
  rules:

    # KI / PIC : créer et modifier les évaluations de leurs apprenants
    # → même périmètre org ET même marque (ET strict, d'où le bloc condition)
    - actions: ["create", "update"]
      effect: EFFECT_ALLOW
      roles: ["ki", "pic"]
      condition:
        match:
          all:
            of:
              - expr: request.principal.attr.scopeNode in request.resource.attr.orgPath
              - expr: request.resource.attr.brand in request.principal.attr.brands

    # Chef d'atelier & directeurs : lecture seule dans leur périmètre org
    - actions: ["read"]
      effect: EFFECT_ALLOW
      roles: ["workshop_manager", "branch_director", "regional_director", "group_director"]
      condition:
        match:
          expr: request.principal.attr.scopeNode in request.resource.attr.orgPath

    # Super admin : tout
    - actions: ["*"]
      effect: EFFECT_ALLOW
      roles: ["superadmin"]
```

Note : les conditions sont dans le bloc `condition` (et non en `derivedRoles`) parce qu'il faut un **ET** rôle + org + marque ; les derived roles s'OR'ent entre eux, c'est le piège classique. Quand 10 ressources réutiliseront « dans le périmètre org », on factorisera `within_org_scope` en derived role.

---

## 5. Flow d'authentification SPA — pattern BFF

Le navigateur ne stocke **aucun** token. Un **BFF** (Backend-For-Frontend) gère le flow OIDC côté serveur et ne renvoie au SPA qu'un **cookie de session httpOnly**. C'est la pratique recommandée actuelle (groupe de travail OAuth de l'IETF, OWASP) pour une SPA manipulant des données sensibles — ici des dossiers RH et de formation. La SPA n'embarque plus keycloak-js et ne voit jamais de jeton, donc une faille XSS ne peut pas exfiltrer de token.

### Topologie

```
SPA React ──cookie httpOnly──▶ BFF ──Bearer JWT──▶ core / operations
                                │
                                ├─ Authorization Code + PKCE ──▶ Keycloak
                                └─ stocke access/refresh tokens côté serveur
```

- La **SPA** fait des appels same-origin (`/api/v1/…`) avec son cookie ; aucun token en JS.
- Le **BFF** échange le code d'autorisation (PKCE) contre les tokens auprès de Keycloak, les conserve côté serveur, et **réinjecte l'access token en `Authorization: Bearer`** vers `core` / `operations`.
- Conséquence clé : **tes services ne changent pas** — ils reçoivent toujours un Bearer à valider via le JWKS Keycloak. Seul le bord navigateur ↔ BFF change par rapport au schéma initial.

### Mise en œuvre la plus légère : oauth2-proxy

Plutôt que de coder le BFF, on pose **oauth2-proxy** devant (il remplace/complète le reverse proxy nginx) :

- client Keycloak **confidentiel** (avec secret, côté serveur — plus de client public),
- Authorization Code + PKCE,
- session en cookie `Secure`, `HttpOnly`, `SameSite=Lax`,
- l'access token est réinjecté en Bearer vers les APIs en amont.

### À ne pas oublier

- **CSRF** : la session étant portée par un cookie, ajoute une protection CSRF (`SameSite` + jeton anti-CSRF ou vérification d'`Origin`/`Referer`).
- La SPA doit être **servie en same-origin** que le BFF (ou via le même proxy) — sinon le blocage des cookies tiers par les navigateurs casse la session.
- Coût assumé : un composant de plus à exploiter. Mais c'est un ajout **incrémental** (le BFF s'insère comme couche d'auth, sans toucher tes APIs) et, vu les données RH en jeu, le gain de sécurité le justifie.

### En dev local (contrainte same-origin)

En dev, Vite tourne sur `:5173` et le BFF sur un autre port → origines différentes, donc le cookie httpOnly serait bloqué. La solution propre : le **proxy du serveur de dev Vite** (`server.proxy`) reroute `/api` et les routes d'auth vers le BFF/oauth2-proxy, de sorte que le navigateur ne parle qu'à l'origine Vite et que les cookies restent same-origin. À éviter : basculer sur keycloak-js « juste en dev » — ça fait diverger l'auth dev/prod, exactement le genre d'écart qui mord en staging.

---

## 6. Environnement de développement

Objectif : développer un module sans lancer les 8 conteneurs.

### Profils Docker Compose

```yaml
# docker-compose.yml (extrait)
services:
  keycloak:    { profiles: ["core", "ops", "full"] }
  cerbos:      { profiles: ["core", "ops", "full"] }   # binaire léger, toujours utile
  core-db:     { profiles: ["core", "full"] }
  core:        { profiles: ["core", "full"] }
  ops-db:      { profiles: ["ops", "full"] }
  operations:  { profiles: ["ops", "full"] }
  gateway:     { profiles: ["full"] }
```

```bash
docker compose --profile core up      # identity/lms/recruitment : keycloak + cerbos + core(+db)
docker compose --profile ops  up      # sessions/tickets : keycloak + cerbos + operations(+db)
docker compose --profile full up      # tout
```

### Pratiques

- **Realm en config-as-code** : gère le realm avec **keycloak-config-cli** (état désiré en JSON/YAML versionné, appliqué sans redémarrage) plutôt qu'un export manuel → démarrage reproductible et dérive détectable. Le provider Terraform Keycloak est l'alternative la plus répandue si tu passes à Terraform.
- **Dégradation gracieuse** : `integration/operations_client.py` retourne un résultat vide/explicite si operations est absent, pour que `core` tourne seul.
- **Boucle rapide** : faire tourner Django en natif (`runserver`) contre les dépendances dockerisées (db, keycloak, cerbos) — recharge instantanée sans rebuild d'image.

---

## 7. Stratégie de sauvegarde

Trois stores avec état : `core-db`, `ops-db`, `keycloak-db`. **Cerbos n'a pas de DB** — ses policies vivent en git, donc « la sauvegarde de Cerbos, c'est le dépôt ».

| Élément | Méthode | Fréquence |
|---------|---------|-----------|
| `core-db`, `ops-db`, `keycloak-db` | `pg_dump` chiffré → stockage objet hors-hôte | quotidien |
| Config Keycloak (realm, clients, mappers) | **keycloak-config-cli** — état désiré JSON/YAML versionné en git | à chaque changement |
| Policies Cerbos | déjà en git | continu |
| Production (étape suivante) | WAL archiving + PITR | quand les enjeux le justifient |

Règles : sauvegardes **hors de l'hôte** (les volumes Docker ne sont pas une sauvegarde), chiffrées, avec rétention définie, et **restauration testée périodiquement** (une sauvegarde jamais restaurée n'est pas une sauvegarde). Le realm en config-as-code (keycloak-config-cli, ou le provider Terraform Keycloak si tu passes à Terraform) = recréer Keycloak revient à restaurer la DB et réappliquer la config déclarative — dérive détectable, pas de ClickOps.

---

## 8. Attribution de droits par personne

Besoin : depuis l'UI d'admin (app 11), accorder une fonctionnalité à une personne précise. Trois mécanismes, du plus maintenable au plus exceptionnel. **Dans tous les cas, le droit accordé reste borné par le scope 3D de la personne (org × département × marque)** — la granularité par personne s'ajoute au scope, elle ne le remplace pas.

### 8.1 Rôles cumulables (défaut)

`role_assignment` étant une table à part, un utilisateur peut cumuler plusieurs affectations. « Donner la fonctionnalité X à Untel » = lui assigner le rôle qui porte X, avec le bon scope. L'accès reste explicable (« pourquoi Y a X ? → rôle Z »), ce qui préserve l'auditabilité. À privilégier.

### 8.2 Approche par attributs (pour du « par fonctionnalité » piloté depuis l'UI)

Plutôt que des bascules ad hoc par utilisateur (cauchemar d'audit), on fait porter au principal des attributs comme `allowed_features`, et les policies Cerbos les lisent. L'admin coche des fonctionnalités → flags écrits sur le compte dans `identity` → Cerbos évalue `request.principal.attr.allowed_features`. Un octroi devient une **donnée modifiée**, pas un redéploiement de policy.

```yaml
# extrait d'une resource policy lisant un flag par personne
- actions: ["export"]
  effect: EFFECT_ALLOW
  roles: ["branch_director"]
  condition:
    match:
      expr: '"reporting_export" in request.principal.attr.allowed_features'
```

### 8.3 Principal policies (vraies exceptions, avec parcimonie)

Cerbos permet des overrides ciblés sur un utilisateur précis : accès élevé temporaire, suspension, droit spécifique qu'un rôle ne couvre pas (ex. un DPO qui peut supprimer un contact).

```yaml
apiVersion: api.cerbos.dev/v1
principalPolicy:
  principal: "u_dpo1"          # ID du compte
  version: "default"
  rules:
    - resource: contact
      actions:
        - action: "delete"
          effect: EFFECT_ALLOW
```

À réserver aux vraies exceptions : ces policies rendent l'autorisation plus dure à comprendre et à débugger. À revoir périodiquement pour retirer les overrides obsolètes. Le quotidien doit passer par §8.1 / §8.2.

### 8.4 CMS — éditorial délégué à Wagtail

Le module `cms` (blog vitrine, app 01) tourne sous **Wagtail**. On ne fait **pas** passer l'édition d'articles par Cerbos : le workflow brouillon → relecture → publication est géré nativement par Wagtail. Cerbos gate seulement l'accès au CMS via un rôle **`content_editor`** (scope filiale ou groupe). Les lecteurs du blog public ne s'authentifient pas. Principe : Cerbos pour l'authz métier de la plateforme, Wagtail pour l'éditorial — pas de duplication.