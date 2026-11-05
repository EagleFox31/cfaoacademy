# 13 — Nœud D (LMS) · incrément 1 : catalogue (TDD + live)

## Contexte
Démarrage du LMS (nœud D) par le **socle acquisition** : le **catalogue de formation**,
aligné sur le référentiel **MEDACAP** (marque × groupe fonctionnel × palier Junior/Senior/Expert).
Cf. principe directeur : MESURER → PIF → **ACQUÉRIR** → CERTIFIER → APPLIQUER → PERFORMER.

## Décision (rappel)
La **mesure** des compétences reste **MEDACAP** (PHP/Mongo existant) — on l'intègrera via contrat.
Le nœud D construit les couches **nouvelles** : acquisition (ici), puis PIF, certification, IA.
Le catalogue est **global** (pas scopé org) ; l'**inscription** (scopée) viendra à l'incrément 2.

## Tests exécutés (écrits AVANT)
```bash
.venv/Scripts/python -m pytest -q                 # 53 passed
docker compose exec cerbos /cerbos compile ...    # 54 OK (CourseSuite 15)
# live : superadmin crée, apprenant lit, apprenant ne peut pas écrire
```
Cas : catalogue anonyme refusé ; **lecture pour tout authentifié** ; **écriture refusée à l'apprenant**
(négatif) ; écriture OK pour rôle contenu. Cerbos `course` : view/list `["*"]`, write `[trainer,
content_editor, center_director, superadmin]`, apprenant write DENY.

## Modifications
- App `lms/` : `Course` (titre, marque, GF, palier, publié) + `Module` (ordonné, kind elearning/
  vidéo/interactif/quiz), `CourseSerializer` (modules imbriqués), `CourseViewSet`/`ModuleViewSet`.
- `cerbos/.../course.yaml` (+ test) : catalogue global, écriture rôles contenu.
- Wiring : `INSTALLED_APPS += lms`, route `/api/v1/core/lms/courses` + `/modules`, migration `lms 0001`.

## Résultat final
- **pytest 53** · **Cerbos 54** · **live** : superadmin POST `course` → **201**, apprenant POST → **403**,
  apprenant GET catalogue → **1 cours**. (Rappel gotcha : `docker compose restart cerbos` après ajout de policy.)

## Périmètre couvert
- Catalogue de formation **global** (lecture ouverte aux authentifiés, écriture rôles contenu),
  structuré selon le **référentiel MEDACAP** (marque/GF/palier) — fondation de l'acquisition.

## NON couvert (→ incrément 2 et suite)
- **Inscription (Enrollment) scopée** + **progression** + vue « mes modules » / « progression de mon équipe » (02-x).
- **Parcours/Path** (scénarios), **exercices interactifs**, **Assistant IA**.
- **Contrat MEDACAP** (lire les résultats de compétence) → base du **PIF** (gap).
- **Certification**, KI/PIC (epic 03).
- Filtre `published` pour les apprenants (catalogue renvoie tout pour l'instant).
