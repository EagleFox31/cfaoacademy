# 14 — Nœud D (LMS) · incrément 2 : inscription + progression (TDD + live)

## Contexte
Première brique **apprenant** : s'inscrire à un cours, suivre sa progression ; un encadrant voit
les inscriptions de **son équipe** (02-1/02-2/02-4/02-7). Ressource **scopée** + règle **self**.

## Tests exécutés (écrits AVANT)
```bash
.venv/Scripts/python -m pytest -q              # 59 passed
docker compose exec cerbos /cerbos compile ... # 62 OK (EnrollmentSuite 8)
# live : auto-inscription + visibilité par périmètre
```
Cas : anonyme refusé ; **auto-inscription** (self) ; liste filtrée (self OU équipe-scope) ;
**progression** (PATCH) ; **retrieve hors-scope → 403** (négatif). Cerbos `enrollment` : self ALLOW,
manager in-scope ALLOW, **manager hors-scope DENY**.

## Modifications
- `lms.Enrollment` (ScopedModel : `learner_sub`, `course`, `status`, `progress_pct`, `org_path`).
- `EnrollmentViewSet` : liste par query plan (`self OU team_within_scope`), `org_path` rempli
  côté serveur depuis le `scope_paths` de l'apprenant ; `EnrollmentSerializer` (validators=[] car
  `learner_sub` est serveur).
- Cerbos : policy `enrollment` (self + `team_within_scope`) + **nouveau rôle dérivé `team_within_scope`**
  (managers + RH + direction + admins, condition multi-scope).

## Bug d'intégration trouvé en live (et corrigé)
`org_path` des inscriptions restait **vide** → l'encadrant ne voyait rien. Cause : le **seed**
récupérait les vrais `sub` Keycloak **par user** (API admin) de façon **flaky** — kouame avait gardé
le `sub` fallback (`1111…`) ≠ son vrai `sub` token (`73a4…`), donc `perform_create` ne trouvait pas le
`User` pour calculer `org_path`. **Fix** : le seed récupère désormais **tous les users en un seul
appel** (map username→sub). Re-seed → kouame a son vrai `sub` → `org_path` correct.

## Résultat final
- **pytest 59** · **Cerbos 62** · **live** : auto-inscription **201** ; kouame voit la sienne (self) ;
  **aminata (RH CIV) voit l'inscription de kouame** ; **seydou (Sénégal) ne la voit pas** (hors-scope).

## Périmètre couvert
- Inscription self + affectation encadrée, progression, **liste scopée multi-niveaux** (apprenant/équipe).
- Seed dev **fiabilisé** (subs réels en un appel).

## NON couvert (suite)
- **Lecteur e-learning** réel (contenu des modules) + exercices interactifs ; **Assistant IA**.
- **Parcours/Path** (séquence scénarisée).
- **Contrat MEDACAP** (résultats de compétence) → **PIF** ; **certification** ; **provisioning-on-login**
  (éliminerait définitivement le couplage seed↔sub).
