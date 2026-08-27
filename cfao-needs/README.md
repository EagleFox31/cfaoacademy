# cfao-needs — Recueil des besoins de formation (app 16)

> **Module détachable.** Tout ce dont il a besoin est dans ce dossier : sa base, son
> Keycloak, son Cerbos, son worker, sa passerelle. `docker compose up` ici suffit,
> sur une machine vierge, sans le reste du dépôt.
>
> Spécification : [`../docs/SPEC_RECUEIL_BESOINS_2027.md`](../docs/SPEC_RECUEIL_BESOINS_2027.md)
> · Stories : [`../backlog.md`](../backlog.md) §16 · PERT : nœud **N**

---

## Démarrer

```bash
cp .env.example .env         # puis remplir les 4 secrets — aucun n'a de défaut
make up
make migrate                 # explicite : jamais dans l'entrypoint
make seed
```

Interface sur `http://localhost:8080`, Keycloak sur `http://localhost:8081`.

```bash
make test          # tests Python
make policy-test   # tests Cerbos — positifs ET négatifs
```

**En intégration continue** : les jobs `cfao-needs (app 16 · Django · pytest)`,
`cfao-needs (app 16 · Vite · build)` et l'étape « app 16 » du job Policies Cerbos.
La CI se déclenche à l'ouverture de la pull request — une branche de feature poussée
seule ne déclenche rien (`.github/workflows/ci.yml`).

---

## Arborescence

```
cfao-needs/
├── docker-compose.yml      ← la stack complète, 7 services
├── .env.example            ← forme des variables, jamais de secret réel
├── Makefile
│
├── api/                    ← service Django (API + worker, même image)
│   ├── config/settings/    base · dev · test
│   ├── core/               socle repris de cfao-core
│   │   ├── auth/           oidc · principal · identity  ← la bascule standalone/integrated
│   │   ├── authz/          cerbos · permissions · filters · viewsets
│   │   └── imports/        LE PATRON D'IMPORT TABULAIRE (columns · base · template)
│   ├── referential/        familles, marques, alias, organisation, profils
│   ├── campaigns/          campagne · catalogue · soumissions · besoins
│   │   ├── services/       summary · transitions
│   │   └── imports/        catalog  ← clé (famille, marque, code)
│   └── outbound/           file de sortie et emails
│       ├── catalog.py      ← le catalogue des messages ET la règle d'envoi
│       └── services/       queue · render · backends · sender
│
├── cerbos/
│   ├── policies/           needs_campaign · needs_line · needs_submission · needs_outbound
│   └── tests/              positifs + négatifs (obligatoires)
│
├── keycloak/               realm en config-as-code
├── gateway/                nginx : sert la SPA, route l'API
└── web/                    SPA React/Vite
```

---

## Les trois règles qui structurent le code

### 1 · Rien ne sort sans relecture

Aucun email ne part vers une filiale sans qu'un membre de l'équipe Academy l'ait
validé dans la plateforme.

```
① le manager soumet
        │  seul envoi automatique — et il est INTERNE
        ▼
② l'équipe Academy reçoit un résumé + un lien profond
        ▼
③ elle relit la fiche dans la plateforme
        ▼  « Valider »
④ confirmation à l'auteur, SES destinataires en copie
```

Ce n'est pas une convention, c'est un invariant tenu à trois niveaux :

| Où | Quoi |
|----|------|
| [`outbound/catalog.py`](api/outbound/catalog.py) | Chaque type déclare son audience et son mode ; `assert_catalog_is_safe()` **fait échouer le démarrage** si un type externe est en `AUTO` |
| [`outbound/services/queue.py`](api/outbound/services/queue.py) | `enqueue()` revérifie les **adresses réelles** — un type interne avec un destinataire externe bascule en relecture |
| [`cerbos/policies/resource_policies/needs_outbound.yaml`](cerbos/policies/resource_policies/needs_outbound.yaml) | `DENY` explicite sur tous les rôles de filiale |

### 2 · La clé naturelle est `(famille, marque, code)`

Le fichier de référence compte **261 lignes pour 231 codes distincts** : `TP02`
existe à l'identique sur dix marques. Dédoublonner sur `code` seul perd 30 lignes,
en silence.

`brand` est **nullable** (formation transverse). PostgreSQL ne considérant pas deux
`NULL` comme égaux, l'unicité passe par deux contraintes partielles — voir
[`campaigns/models.py`](api/campaigns/models.py).

Le test qui garde cette règle :
`campaigns/tests/test_catalog_import.py::test_meme_code_sur_dix_marques_donne_dix_lignes`.

### 3 · Une famille sans catalogue s'affiche mais ne se saisit pas

Les catalogues arrivent progressivement. `CatalogFamily.status` vaut `READY`,
`PENDING` ou `HIDDEN` : la campagne s'ouvre **sans attendre le dernier catalogue**,
et chaque famille se branche par un simple import — pas de migration, pas de
redéploiement.

---

## Détachabilité — comment ça marche

Un seul point du code connaît la différence entre les deux modes :
[`core/auth/identity.py`](api/core/auth/identity.py).

| | `standalone` | `integrated` |
|---|---|---|
| Identité | Keycloak embarqué, realm `cfao-needs` | Keycloak plateforme |
| Autorisation | Cerbos embarqué | Cerbos plateforme, mêmes policies |
| Périmètre | `referential.UserProfile` (import) | `identity` plateforme (`GET /me`, cache 60 s) |
| Catalogue | table locale (import) | synchronisé depuis `lms.Course` |

Le basculement se fait par `NEEDS_DEPLOYMENT_MODE`, jamais par modification de code.

---

## Budget de ressources

Chaque service déclare son plafond, **calibré sur une mesure** — norme projet
(`../planning.md` §7, `../architecture.md` §7).

Mesures au repos, médiane sur 5 relevés (un échantillon unique attrape les sondes et
ment d'un ordre de grandeur).

| Service | CPU | Mémoire | Plafond |
|---------|----:|--------:|--------:|
| needs-keycloak | 0,3 % | 337 Mio | 768 Mio |
| needs-api | 0,01 % | 103 Mio | 512 Mio |
| needs-worker | 0,9 % | 82 Mio | 384 Mio |
| needs-cerbos | 1,5 % | 38 Mio | 256 Mio |
| needs-db | 0,9 % | 23 Mio | 512 Mio |
| needs-kc-db | 0,1 % | 19 Mio | 256 Mio |
| needs-gateway | 0 % | 3 Mio | 64 Mio |
| **Total** | **~3,7 %** | **~605 Mio** | 2,7 Gio |

**Avant réglages : ~950 Mio et ~11 % de CPU, avec des pics à 165 %.**

Quatre valeurs par défaut ramenées à l'usage réel :

| Réglage | Défaut | Ici | Gain |
|---|---|---|---|
| Tas JVM Keycloak | libre (524 Mio) | `-Xmx256m` | −190 Mio |
| Workers gunicorn | 3 | 2 | −60 Mio |
| Django-Q `guard_cycle` | 0,5 s | 5 s | 4 % → 0,9 % |
| Sondes de santé | 10–15 s | 20–30 s, `python -S` | pics 165 % → 0 |

> La sonde de l'API coûtait plus cher que l'API elle-même : un interpréteur Python
> lancé toutes les 15 s, pour un service à 0,01 % d'usage réel.

Pas de limite CPU : le throttling est silencieux et se diagnostique mal. On agit sur la
cause, pas sur le symptôme.

---

## Les onze interdits

Repris de l'audit Academix ([`../docs/AUDIT_ACADEMIX.md`](../docs/AUDIT_ACADEMIX.md) §4).
Chacun est un contrôle, pas une consigne.

| # | Interdit | Où c'est tenu |
|---|----------|---------------|
| 1 | Mot de passe stocké | Aucune colonne mot de passe — Keycloak est seul dépositaire |
| 2 | Identifiants dans le dépôt | Gitleaks en CI · `.gitignore` |
| 3 | Secret par défaut en dur | `settings/base.py` — `env("NEEDS_SECRET_KEY")` sans défaut : **le boot échoue** |
| 4 | `.env` versionné | `.gitignore` |
| 5 | CORS ouvert | `CORS_ALLOWED_ORIGINS` explicite, jamais `*` |
| 6 | Rôle lu côté client | Le SPA n'utilise le JWT que pour l'affichage ; toute décision vient de l'API |
| 7 | Deux chemins d'authentification | Un seul middleware, un seul code d'erreur (401) — `core/auth/oidc.py` |
| 8 | Endpoint sans PEP | `CerbosPermission` sur chaque vue ; pas de `cerbos_resource_kind` ⇒ refus |
| 9 | Dépendance vulnérable | `pip-audit` en CI ; `openpyxl` côté serveur, jamais `xlsx` côté navigateur |
| 10 | Migration + seed au démarrage | Entrypoint = gunicorn seul ; `make migrate` / `make seed` explicites |
| 11 | Envoi automatique vers l'extérieur | `assert_catalog_is_safe()` au boot |

---

## État R0

| | |
|---|---|
| ✅ | Arborescence, socle Django, `docker-compose.yml`, realm Keycloak, passerelle |
| ✅ | Modèle de données complet (familles, campagne, catalogue, soumissions, besoins, file de sortie) |
| ✅ | Patron d'import tabulaire + importeur de catalogue — **10 tests passent** |
| ✅ | Circuit d'envoi à validation — **10 tests passent** |
| ✅ | Policies Cerbos `needs_*` — **58 tests exécutés, 58 verts** (positifs et négatifs) |
| ✅ | **SPA — les 7 pages du parcours**, build Vite vert (216 Ko JS, 9,4 Ko CSS) |
| ✅ | **Bilingue FR/EN** — 137 clés utilisées, catalogues stricts et alignés (aucune manquante) |
| ✅ | Seeds — **259 lignes du catalogue 2027 réel**, 21 marques, 8 familles, 28 modèles d'emails (14 clés × 2 langues) |
| ✅ | **Stack complète démarrée et vérifiée** — 7 conteneurs, realm importé, décisions Cerbos live, SPA servie, 401 sans jeton |
| ⏳ | Relances et regroupement par inactivité (tâches planifiées) — **R1** |

### Les 7 pages

| Route | Écran | Rôle |
|-------|-------|------|
| `/` | Campagne — familles, statuts, CTA | Filiale |
| `/saisie` | Grille : T1–T4 × effectif + lieu, brouillon serveur, filtres | Filiale |
| `/recapitulatif` | Récapitulatif, destinataires en copie, envoi | Filiale |
| `/suivi` | Suivi de la déclaration + historique | Filiale |
| `/relecture` | Fiches à relire, ancienneté, alerte SLA 48 h | Academy |
| `/relecture/:id` | Fiche : récapitulatif, lignes, valider / réouvrir | Academy |
| `/a-envoyer` | File d'envoi : prévisualisation, approbation par lot, rejet motivé | Academy |
