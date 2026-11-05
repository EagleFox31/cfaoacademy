# Audit Academix — l'existant à remplacer

> Audit réalisé le **25 août 2026** sur le dépôt `Documents/academy`, état au commit `b2354b3d`
> (28 janvier 2026). Academix est **remplacé** par CFAO Academy ; ce document fixe ce qu'on en
> reprend, ce qu'on refuse, et la correspondance avec nos epics.
>
> Version détaillée et navigable : *Dossier de reprise Academix* (artefact publié).

---

## 1. Ce qu'est Academix

Pas un LMS. Le modèle central s'appelle `Formation` mais désigne une **session** : dates, lieu, pays
hôte, formateur, places, statut d'ouverture. Ni module e-learning, ni QCM, ni compétence, ni
certification, ni parcours.

C'est un **outil d'administration logistique du centre de Douala** doublé d'un **recueil trimestriel
des besoins des managers filiales**. En production depuis octobre 2025.

**Chiffres.** 84 commits (15 sept. 2025 → 28 janv. 2026), 42 PR, 2 contributrices principales,
62 migrations Alembic, 89 composants React, 7 fichiers de test backend, 0 test frontend.

**Stack.** FastAPI + SQLAlchemy + PostgreSQL 13 · React 19 + Vite + TypeScript · nginx · Docker
Compose · Prometheus / Grafana.

---

## 2. Les 26 fonctions auditées

| Réf | Fonction | Valeur |
|-----|----------|--------|
| **F01** | Authentification JWT maison (jose, bcrypt, refresh 30 j) | Remplacée par Keycloak |
| **F02** | `require_roles` recopié sur ~50 endpoints, 9 rôles figés | Remplacé par Cerbos |
| **F03** | Comptes, import Mongo, envoi des identifiants par email | Besoin valide, solution dangereuse (§4) |
| **F04** | Référentiels pôle / marque / pays / type | Remplacé par `identity` |
| **F05** | Catalogue + import DOCX/ZIP, cycle `pending → published` | **À reprendre** |
| **F06** | Cycle de vie des sessions, règles jours ouvrés, soft delete | Métier à reprendre, modèle à redécouper |
| **F07** | **Logistique et coût par stagiaire** (vols, nuitées, visa, FCFA) | **Écart — rien ne le couvre** |
| **F08** | Base apprenants (fiche administrative, sans compte) | Données à migrer |
| **F09** | Formateurs (utilisateur de rôle Formateur) | Périmètre plus large chez nous |
| **F10** | **Besoins trimestriels par marque et filiale** | **Écart — devient l'app 16** |
| **F11** | Import Excel des besoins, résolution de conflits | **Écart — leçon d'adoption** |
| **F12** | Répartition et arbitrage (carte, clé JSON) | App 07, règle à rendre auditable |
| **F13** | Tableaux de bord par rôle, KPI, graphiques | App 07 |
| **F14** | **Calendrier matriciel annuel** (mois × marque × formateur × jours) | **Écart — spec réutilisable** |
| **F15** | Calendrier interactif | App 05 |
| **F16** | Exports JSON versionné, ICS, XLSX | App 10 |
| **F17** | Templates email en base, composition, journal d'envoi + renvoi | **À reprendre** — absent de notre app 14 |
| **F18** | Relances automatiques, machine à états, temporisation | **À reprendre tel quel** |
| **F19** | Emails bilingues + civilité | Besoin juste, **implémentation à corriger** |
| **F20** | Journalisation d'activité (lots, idempotence, IP hachée, 90 j) | **À reprendre** — la partie la plus rigoureuse |
| **F21** | Prometheus, Grafana, alertes, SLI | Réutilisable |
| **F22** | **Imports Excel tolérants** (synonymes, modèle, rapport) | **À reprendre** → `PATRON_IMPORT_TABULAIRE.md` |
| **F23** | Compose, nginx, CloudFormation, scripts de déploiement | Notre socle est plus complet |
| **F24** | Front monolithique — `App.tsx` 1 440 lignes, 89 composants à plat | Dette |
| **F25** | Interface bilingue (fr/en) | Déjà en place chez nous |
| **F26** | Fenêtres détachées, thème sombre, glassmorphism | Besoin de comparaison à couvrir autrement |

---

## 3. Les principes qui structurent Academix

1. **Excel est l'interface réelle.** Tout entre et sort en classeur.
2. **L'email est le canal de vérité.** L'application notifie, elle n'attend pas la visite.
3. **Remplacer plutôt que différencier.** Mettre à jour une liste la remplace entièrement — on perd
   qui a été retiré et quand. *Interdit chez nous.*
4. **Jeu de données versionné + copie navigateur.** Mode dégradé de fait quand le réseau filiale lâche.
5. **Le rôle est une énumération, le périmètre est implicite.** Filiale et marque en chaînes de
   caractères — la limite structurelle qui empêche le multi-filiales cloisonné.
6. **On n'efface pas, on marque.** Suppression logique et compteur de version.
7. **Désormalisation assumée.** Nom et email du manager recopiés sur chaque besoin.
8. **Le front décide, le back suit.** Endpoints taillés pour un écran (1 052 lignes sur un routeur).
9. **Pas de file d'attente.** SMTP synchrone dans la requête HTTP.
10. **Correction en production.** Pas d'environnement de recette — les séries de PR correctives et le
    commit « modif express depuis le serveur » en sont la conséquence.

---

## 4. Failles — les dix interdits

Les trois premières sont **critiques et actives en production**. Elles appellent une décision
indépendante de la migration.

| Sév. | Constat | Emplacement |
|------|---------|-------------|
| **Critique** | `visible_password` : mot de passe en clair en base **et renvoyé par l'API** | `db/models/user.py:22`, `api/v1/users.py:239-240` |
| **Critique** | 108 identifiants réels commités (emails `@cfao.com` + mots de passe) | `public/users.json` (16), `public/managers.json` (92) |
| **Critique** | `SECRET_KEY` JWT par défaut en dur — permet de forger un jeton Super Admin | `core/config.py:38` |
| Élevé | `.env` et `.env.production` suivis par Git | `git ls-files` |
| Élevé | CORS `allow_origins=["*"]` + `allow_credentials=True`, annule la liste blanche | `main.py:73-79` |
| Élevé | Rôle restauré depuis `localStorage` sans revalidation | `contexts/AuthContext.tsx:26-46` |
| Élevé | Deux `get_current_user` divergents — 404 sur compte inconnu permet l'énumération | `api/deps.py:16`, `core/security.py:54` |
| Moyen | Autorisation dupliquée sur ~50 endpoints, aucun test négatif | `api/v1/*.py` |
| Moyen | Dépendance `xlsx` 0.18.5 (vulnérabilités connues, traite des fichiers tiers) | `package.json` |
| Moyen | CI sans test ni scan — construit et pousse deux images | `.github/workflows/deploy.yml` |

> Ces dix points sont repris comme **contrôles CI** dans `SPEC_RECUEIL_BESOINS_2027.md` §10.

**Actions sur Academix, indépendantes de la reprise :** révoquer les 108 mots de passe, réécrire
l'historique Git, supprimer `visible_password` et son exposition, surcharger la clé de signature.

---

## 5. Correspondance avec nos epics

| Réf | Correspond à | Nœud | État chez nous |
|-----|--------------|------|----------------|
| F01, F02 | `T-1`, `T-2`, `T-3` | A · B · C | **Fait**, et supérieur |
| F03, F04 | App 11, App 12 | B | **Fait** |
| F05 | `00-4`, App 01/02 | D · M | Partiel |
| F06, F09 | App 08, App 04 | E | À faire |
| **F07** | — | E | **Écart → story `08-7`** |
| F08 | `00-2`, App 02 | B · M | Fait (données à migrer) |
| **F10, F11** | — | **N** | **Écart → epic 16** |
| F12, F13 | App 07 | H | Partiel (portail en données simulées) |
| **F14** | — | E | **Écart → story `05-5`** |
| F15, F16 | App 05, App 10 | E · H | Partiel |
| F17, F18, F19 | App 14 | I | À faire — stories enrichies |
| F20 | `12-4`, module `audit` | B · C | Partiel |
| F21 | Infra | A | À faire |
| F22 | `00-2`, `00-4`, `00-5` | M | **→ `PATRON_IMPORT_TABULAIRE.md`** |
| F23 | Infra | A | Fait |
| F24, F25, F26 | Architecture 3 niveaux | — | Fait |

**Synthèse.** Sur 26 fonctions : 10 déjà couvertes et mieux, 6 partielles, 5 planifiées, **5 écarts
francs** — F07, F10, F11, F14 et la comparaison côte à côte de F26.

Ces cinq écarts ont un point commun : ce sont des besoins **du centre qui organise**, pas de
l'apprenant. Notre backlog a été écrit du point de vue apprenant et terrain ; il manquait celui de
l'équipe Academy.

---

## 6. Données à migrer

| Source Academix | Cible | Story |
|-----------------|-------|-------|
| 92 managers filiales | `identity.User` + `RoleAssignment` | `00-2` |
| Catalogue formations + fiches visuelles | `lms.Course` / `Module` | `00-4` |
| Historique des besoins 2026 | `needs` — campagne 2026 archivée, base de comparaison en relecture | `backlog.md` §16 |
| Apprenants et inscriptions | `identity` + `lms.Enrollment` | `00-2`, `00-4` |

**Les identifiants ne sont pas migrés.** Les comptes sont recréés dans Keycloak avec un premier
accès par lien à usage unique.

---

## 7. Références

- Spécification du remplacement du recueil : `docs/SPEC_RECUEIL_BESOINS_2027.md`
- Patron d'import : `docs/PATRON_IMPORT_TABULAIRE.md`
- Stories : `backlog.md` §16, §00, §14, §05, §08
- Planification : `planning.md` §2 nœud **N**
