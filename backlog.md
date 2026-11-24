# CFAO Academy — Backlog initial

Chaque application = un **epic**. Les user stories sont rédigées pour être estimables, au format « En tant que … je veux … afin de … ». ID = `NN-x` (NN = numéro d'app).

---

## Note transverse — séquence de tests par fonctionnalité

Après **chaque** story livrée, exécuter **dans cet ordre** : **tests unitaires** → **tests d'intégration** → **tests de contrat** (si API ou webhook inter-service) → **tests E2E** (si parcours utilisateur ou rôle métier). Détail, outils et Definition of Done : `planning.md` §6.

---

## Note transverse — la double casquette KI / PIC

Un **KI / PIC est à la fois apprenant et instructeur**, et il faut le modéliser explicitement :

- **Apprenant** : il a des **formations attribuées** qu'il suit pour sa propre progression et ses certifications (comme tout technicien).
- **Instructeur interne / formateur suppléant** : il a des **formations à dispenser** qu'il anime auprès des niveaux inférieurs, **directement en filiale** — distinct du formateur certifié constructeur de l'Academy.

Implications :
- **Modèle** : `ki` / `pic` portent l'attribut apprenant **et** l'attribut pédagogique interne. Le « formateur suppléant » est un instructeur de filiale (≠ rôle `trainer` Academy). *À refléter dans `PLATFORM_ROLES.md`.*
- **Données** : deux relations distinctes sur le compte — `formations_attribuées` (qu'il suit) et `formations_à_dispenser` (qu'il anime).
- **UI** : son portail a deux entrées — « Mon parcours » (apprenant, app 02) et « Mes formations à animer » (instructeur, app 03).
- **Scope** : son activité d'instructeur reste limitée à sa marque certifiée et à sa filiale.

---

## 00 · Migration & initialisation — *epic : mise en production initiale*

> Epic transverse — à traiter **avant** ou **en parallèle** du sprint 1. Pas d'apps utilisables sans données initiales.

- `00-1` En tant qu'admin groupe, je veux initialiser la structure organisationnelle (groupe, régions, filiales, agences, départements, marques) afin que les scopes soient opérationnels dès le premier login.
- `00-2` En tant qu'admin groupe, je veux importer les comptes collaborateurs existants (email, rôle, filiale, département, marques) afin que personne n'ait à re-créer son compte.
- `00-3` En tant que système, je veux migrer les articles existants du site React vers Wagtail (titre, contenu, image, date, catégorie) afin de ne pas perdre l'historique éditorial.
- `00-4` En tant que système, je veux migrer le catalogue de formations (formations, sessions, marques, niveaux) vers le module `lms` / `sessions` afin d'alimenter le backend dès l'ouverture.
- `00-5` En tant qu'admin, je veux valider chaque lot migré (contrôle d'intégrité, rapprochement compte / rôle / scope) afin de détecter les anomalies avant l'ouverture aux utilisateurs.
- `00-6` En tant que système, je veux que le realm Keycloak soit initialisé via `keycloak-config-cli` (clients OAuth, mappers, upstream MS/Google) afin que l'environnement soit reproductible et non dépendant d'une configuration manuelle.
- `00-7` En tant que tech lead, je veux un script de smoke test post-migration qui vérifie qu'un compte de chaque rôle peut se connecter et accéder à ses apps afin de valider la mise en production.
- `00-8` En tant que tech lead, je veux une **gate go-live** (checklist migration + smoke + rollback documenté) validée avant toute ouverture aux utilisateurs réels afin de ne pas basculer en prod sur des données ou droits incohérents.
- `00-9` En tant que système, je veux que **tout import de fichier** (comptes, catalogue, sessions, besoins) applique le **patron d'import tabulaire** — synonymes d'en-têtes, modèle vierge téléchargeable, prévisualisation avant écriture, rapport d'erreurs exhaustif, transaction tout-ou-rien — afin qu'une filiale puisse déposer son classeur habituel et corriger seule ses erreurs. → **`docs/PATRON_IMPORT_TABULAIRE.md`**

> **Planification PERT** : le nœud **M (Migration 00)** converge vers la gate **J** ; webhooks inter-services documentés sur le graphe → voir `planning.md`.

> **Patron d'import.** `00-2`, `00-4` et `00-5` sont des applications du patron `00-9`. Chaque import déclare sa **clé naturelle** et la teste sur un jeu contenant un doublon volontaire sur clé partielle — le catalogue formations se rapproche sur `(famille, marque, code)`, jamais sur `code` seul.

---

## 01 · Site public — *epic : vitrine publique*

- `01-1` En tant que visiteur, je veux parcourir le catalogue des formations afin d'évaluer l'offre.
- `01-2` En tant que visiteur, je veux consulter les sessions ouvertes et leur calendrier afin de me positionner.
- `01-3` En tant que visiteur, je veux lire les actualités afin de suivre la vie de l'Academy.
- `01-4` En tant que visiteur, je veux envoyer un message via le formulaire de contact.
- `01-5` En tant qu'utilisateur connecté, je veux accéder à mon portail selon mon rôle depuis le site.

## 02 · Espace apprenant (LMS) — *epic : parcours apprenant*

- `02-1` En tant qu'apprenant, je veux voir mes modules attribués afin de savoir quoi suivre.
- `02-2` En tant qu'apprenant, je veux suivre des modules e-learning afin de progresser.
- `02-3` En tant qu'apprenant, je veux passer mes évaluations afin de valider mes acquis.
- `02-4` En tant qu'apprenant, je veux suivre ma progression afin de me situer dans mon parcours.
- `02-5` En tant qu'apprenant, je veux télécharger mes attestations et certifications.
- `02-6` **En tant que KI/PIC, je veux suivre mon propre parcours d'apprenant (formations attribuées) afin de progresser et me certifier comme tout technicien.**
- `02-7` En tant que chef d'équipe / d'atelier, je veux consulter la progression de mon équipe (agence + marques) en lecture.
- `02-8` En tant que RH / Admin, je veux consulter les dossiers de formation des collaborateurs de mon périmètre.

## 03 · Espace KI / PIC — *epic : instruction terrain (formateur suppléant)*

- `03-1` **En tant que KI/PIC, je veux voir les formations que je dois dispenser afin de planifier mon activité d'instructeur.**
- `03-2` En tant que KI/PIC, je veux voir mes apprenants assignés afin de suivre qui je forme.
- `03-3` **En tant que KI/PIC, je veux animer et enregistrer une formation interne en filiale (formateur suppléant) afin de former les niveaux inférieurs.**
- `03-4` En tant que KI/PIC, je veux saisir les évaluations de mes apprenants.
- `03-5` En tant que KI/PIC, je veux valider les compétences terrain de mes apprenants.
- `03-6` En tant que KI/PIC, je veux consulter les contenus pédagogiques de référence.
- `03-7` En tant que chef d'atelier, je veux voir les KI/PIC de mon atelier et leurs apprenants.
- `03-8` En tant qu'admin filiale, je veux gérer la liste et les habilitations des KI/PIC.

> Scope : un KI/PIC ne voit que les apprenants de sa marque certifiée (un KI Toyota ne voit que ses apprenants Toyota), dans sa filiale.

## 04 · Espace formateur — *epic : animation Academy*

- `04-1` En tant que formateur, je veux voir mes sessions à animer.
- `04-2` En tant que formateur, je veux gérer mes contenus pédagogiques.
- `04-3` En tant que formateur, je veux gérer les feuilles d'émargement.
- `04-4` En tant que formateur, je veux évaluer les stagiaires.
- `04-5` En tant que formateur, je veux rédiger un rapport post-formation. *(livré en service transitoire — [module](docs/MODULE_RAPPORTS_FORMATEUR.md), [ADR 0001](docs/adr/0001-service-rapports-formateur.md))*
  - `04-5.1` En tant que plateforme, je veux que les rapports exigent un jeton Keycloak et une décision Cerbos (tests négatifs) afin qu'un formateur n'accède qu'à ses rapports.
  - `04-5.2` En tant que plateforme, je veux conserver les brouillons de rapport dans `cfao-operations` (PostgreSQL) afin d'avoir une seule source de vérité par donnée.
  - `04-5.3` En tant que formateur, je veux l'assistant de rapport en français, anglais et portugais.
  - `04-5.4` En tant qu'équipe, je veux un parcours E2E formateur (saisie → rapport) rejoué en CI.
  - `04-5.5` En tant que formateur, je veux retrouver mes sessions depuis le planning réel plutôt que depuis la démonstration.
- `04-6` En tant qu'assistante centre, je veux gérer le planning et les affectations logistiques des formateurs.
- `04-7` En tant que directeur centre, je veux valider les contenus, affecter les sessions et superviser.

## 05 · Planning & réservation de salles — *epic : logistique des espaces*

- `05-1` En tant que formateur / KI, je veux réserver un créneau, une salle ou un équipement pour une session.
- `05-2` En tant qu'utilisateur du centre, je veux voir le planning général et l'occupation.
- `05-3` En tant qu'assistante centre, je veux gérer le planning complet et arbitrer les conflits.
- `05-4` En tant que directeur centre, je veux valider et avoir la vue d'ensemble.
- `05-5` En tant qu'assistante ou directeur centre, je veux un **calendrier matriciel annuel** — lignes groupées mois → marque → formateur, colonnes jours 1 à 31, cellules fusionnées sur la durée de la session, week-ends grisés, couleur par statut, légende et **export Excel** — afin de retrouver et de diffuser le planning mural du centre. *(reprise `docs/AUDIT_ACADEMIX.md` F14 — spécification déjà écrite et validée par les utilisateurs)*

## 06 · Assistance formateurs — *epic : tickets de support*

- `06-1` En tant que formateur / KI, je veux créer un ticket (logistique, pédagogique, technique).
- `06-2` En tant que demandeur, je veux suivre la résolution et clôturer mon ticket.
- `06-3` En tant qu'assistante centre, je veux traiter, répondre, affecter et clôturer les tickets.
- `06-4` En tant que directeur centre, je veux superviser, escalader et valider les tickets prioritaires.

## 07 · Tableau de bord management — *epic : pilotage par KPIs*

- `07-1` En tant que manager, je veux voir les KPIs de mon équipe (certifications, sessions, avancement) filtrés par mon périmètre.
- `07-2` En tant que directeur (filiale / région / groupe), je veux une vue consolidée selon mon périmètre org.
- `07-3` En tant que formateur, je veux voir les stats de mes sessions (taux de succès, certifications délivrées).
- `07-4` En tant que directeur centre, je veux voir la performance Academy et la productivité des formateurs.
- `07-5` En tant que super admin, je veux configurer les KPIs.

## 08 · Gestion des sessions — *epic : cycle de vie des sessions*

- `08-1` En tant qu'assistante centre, je veux créer / modifier une session et ouvrir les inscriptions.
- `08-2` En tant qu'assistante centre, je veux gérer la liste des stagiaires.
- `08-3` En tant que RH / Admin filiale, je veux inscrire des collaborateurs.
- `08-4` En tant que chef d'atelier, je veux proposer des inscriptions pour mon équipe.
- `08-5` En tant que formateur, je veux saisir les présences et les résultats de mes sessions.
- `08-6` En tant que directeur centre, je veux annuler ou modifier en profondeur une session.
- `08-7` En tant qu'assistante centre, je veux saisir la **logistique et le coût par stagiaire** d'une session — vols d'arrivée et de départ, nuitées, hôtel, navettes, visa, frais annexes, total en FCFA — afin de préparer la refacturation à la filiale d'origine. *(reprise `docs/AUDIT_ACADEMIX.md` F07 — le coût réel d'un stagiaire au centre de Douala est son déplacement, pas sa formation)*
- `08-8` En tant que directeur filiale ou RH, je veux consulter le **coût formation consolidé** de mes collaborateurs sur un exercice afin de justifier et piloter mon budget.

> **Périmètre `08-7` / `08-8`.** À modéliser séparément de la session : une table logistique et une table de coûts rattachées à l'inscription, pas cinquante colonnes sur la session (erreur de modélisation Academix F06).

## 09 · Recrutement & évaluation candidats — *epic : pipeline de recrutement*

> **Dépendance LMS.** Les évaluations techniques assignées aux candidats (QCM / tests par marque) sont **hébergées et exécutées dans le module `lms`** — `recruitment` ne duplique pas le moteur de QCM. Il gère le **dossier candidat**, l'**assignation** (quelle éval, quelle marque), la **décision RH** et la **bascule à l'embauche** ; le LMS fournit les banques de questions, le passage du test et le score. *Planification : epic 09 démarre après le socle évaluations/QCM du LMS (pas après le LMS complet).*

- `09-1` En tant que candidat, je veux compléter mon dossier de candidature.
- `09-2` En tant que candidat, je veux passer mes évaluations assignées et voir mes résultats.
- `09-3` En tant que RH, je veux créer un dossier candidat et lui assigner des évaluations par marque.
- `09-4` En tant que formateur (correcteur), je veux saisir les résultats des évaluations techniques.
- `09-5` En tant que directeur filiale, je veux valider une décision de recrutement.
- `09-6` En tant que système, à l'embauche je veux basculer le compte candidat vers le rôle terrain assigné.
- `09-7` En tant que RH groupe, je veux des benchmarks inter-filiales sur les recrutements.

## 10 · Reporting formation — *epic : analytics consolidés*

- `10-1` En tant que responsable, je veux consulter les analytics consolidés (certifications, heures, taux, progression) sur mon périmètre.
- `10-2` En tant que responsable, je veux ventiler les données par org et par marque.
- `10-3` En tant que super admin, je veux exporter les données et configurer les rapports.

## 11 · Administration RH & comptes — *epic : gestion des accès*

- `11-1` En tant qu'admin filiale, je veux créer / modifier un compte et lui assigner rôle + scope (agence / département / marques).
- `11-2` En tant qu'admin, je veux attribuer des fonctionnalités spécifiques à une personne (via attributs, ou principal policy pour les exceptions).
- `11-3` En tant que RH, je veux mettre à jour les infos RH d'un collaborateur.
- `11-4` En tant qu'assistante centre, je veux gérer les inscriptions et les convocations.
- `11-5` En tant que responsable, je veux consulter les historiques.
- `11-6` En tant que super admin, je veux un **tableau de bord de suivi des accès** afin de savoir qui utilise quel module et de repérer les comptes inactifs ou les tentatives suspectes.
  - Le tableau affiche :
    - les connexions par module (jour, 7 jours, 30 jours) ;
    - la dernière connexion par utilisateur ;
    - les comptes jamais utilisés ;
    - les échecs de connexion répétés.
  - Filtres : module, pays, période. Style « application » du cockpit.
  - Source : les événements de connexion du realm commun `cfao` (LOGIN, LOGIN_ERROR, LOGOUT). Le client Keycloak de chaque connexion indique le module. Rien n'est ajouté dans les modules.
  - Contraintes :
    - données personnelles : durée de conservation explicite (90 jours proposés) ;
    - lecture réservée au super admin, selon une policy Cerbos avec tests négatifs.
  - **Dépend de** la fédération (realm commun, L6-L9) et de l'activation des événements dans le realm v2 (voir PASSATION, point 5).

## 12 · Administration plateforme — *epic : structure & configuration*

- `12-1` En tant qu'admin groupe, je veux créer / modifier les filiales, agences et départements.
- `12-2` En tant qu'admin groupe, je veux gérer les marques assignées par département.
- `12-3` En tant que super admin, je veux gérer les rôles système.
- `12-4` En tant que super admin, je veux consulter les logs d'audit.
- `12-5` En tant que super admin, je veux configurer le branding et les intégrations.

## 13 · Blog / CMS (Wagtail) — *epic : communication vitrine*

- `13-1` En tant que content_editor, je veux rédiger un article (événement, formation passée, certification, nouveauté).
- `13-2` En tant que content_editor, je veux gérer les médias et images.
- `13-3` En tant que content_editor, je veux faire passer un article dans le workflow brouillon → relecture → publication.
- `13-4` En tant que visiteur, je veux lire les articles publiés sur le site vitrine — **pages rendues server-side par Wagtail (mode intégré, pour le SEO)**.
- `13-5` *(optionnel, différé)* En tant qu'utilisateur du portail, je veux voir les derniers articles dans le portail React via l'**API headless de Wagtail** — uniquement si le portail doit embarquer du contenu CMS.

## 14 · Notifications — *epic : notifications & emails (sprint 2)*

- `14-1` En tant qu'apprenant, je veux recevoir une confirmation d'inscription à une session afin d'avoir une preuve d'enregistrement.
- `14-2` En tant que stagiaire, je veux recevoir un rappel avant une session afin de ne pas l'oublier.
- `14-3` En tant qu'apprenant, je veux être notifié quand une certification m'est délivrée.
- `14-4` En tant que demandeur, je veux être notifié quand mon ticket est résolu (ou reçoit une réponse).
- `14-5` En tant que candidat, je veux être notifié quand une évaluation m'est assignée.
- `14-6` En tant que KI/PIC, je veux être notifié quand une nouvelle formation à dispenser m'est attribuée.
- `14-7` En tant que formateur, je veux être notifié quand une session m'est affectée.
- `14-8` En tant qu'utilisateur, je veux gérer mes préférences de notification (opt-in/opt-out par type) afin de ne recevoir que l'utile.
- `14-9` En tant qu'utilisateur, je veux un centre de notifications in-app dans le portail, pas seulement des emails.
- `14-10` En tant que système, je veux envoyer les notifications de façon **asynchrone et événementielle** afin de ne pas coupler l'envoi aux requêtes métier.
- `14-11` En tant que système, je veux planifier les notifications **temporelles** (rappels de session, certifications expirantes) via un scheduler.
- `14-12` En tant qu'administrateur, je veux un **journal d'envoi** (destinataires, template et version utilisés, statut envoyé / échec / rejeté, erreur, tentatives) avec **renvoi manuel**, afin de savoir ce qui est réellement parti et de rattraper une indisponibilité du relais. *(reprise `docs/AUDIT_ACADEMIX.md` F17 — absent de la spécification initiale)*
- `14-13` En tant que système, je veux gérer les relances par une **machine à états persistée** sur l'objet concerné (état + horodatage de dernière relance), avec **escalade au responsable** après la dernière relance sans réponse, afin qu'une relance ne parte qu'une fois même si le worker rejoue. *(reprise F18)*
- `14-14` En tant qu'utilisateur qui enchaîne plusieurs actions, je veux recevoir **un seul email groupé** après une temporisation d'inactivité plutôt qu'un mail par action. *(reprise F18)*
- `14-15` En tant qu'utilisateur, je veux que **ma langue et ma civilité soient portées par mon compte** — modifiables par moi — plutôt que déduites de ma filiale, afin de recevoir les messages dans la bonne langue et sans supposition sur mon genre. *(correctif F19 : la déduction par filiale a coûté six PR correctives à Academix ; la civilité par défaut est neutre)*
- `14-16` En tant qu'administrateur, je veux gérer les **templates en base, versionnés et localisés**, avec prévisualisation sur données réelles avant envoi ; l'absence d'une traduction doit **faire échouer la CI**, jamais produire un repli silencieux.

> Architecture : module `notifications` dans `cfao-core`, **abonné aux événements métier** des deux services (`enrollment_created`, `session_completed`, `certificate_issued`, `ticket_resolved`, `assessment_assigned`, `ki_training_assigned`, `session_assigned`…) — les émetteurs ne connaissent pas la logique d'envoi. Envoi **asynchrone** via worker (Celery / Django-Q), fournisseur d'email transactionnel **abstrait derrière une interface** (SES, SendGrid ou Azure Communication Services), templates localisés, et scheduler (`pg_cron` / Celery beat) pour les notifications temporelles. C'est l'un des rares cas qui justifiera un vrai broker quand le volume montera.

> **Hors app 14 :** le **digest hebdomadaire Git** (app 15) réutilise le même canal d'envoi email (`notifications.channels`) mais est déclenché par le module `delivery` (tâche planifiée), pas par un événement métier formation.

## 15 · Pilotage projet & reporting delivery — *epic : cockpit MOA / build + digest Git hebdo*

> Epic **interne** — suivi de la construction plateforme. **K₁** (webhook Git, cockpit) dès phase 1 ; **K₂** (rapports MOA jeudi/vendredi) après socle notifications — **hors chemin critique go-live** (`planning.md` graphe v2).

- `15-1` En tant que super admin, je veux visualiser la roadmap (epics, phases, dépendances PERT) afin de communiquer l'avancement au comité de pilotage.
- `15-2` En tant qu'équipe build, je veux synchroniser ou saisir le statut des stories (backlog, migration `00-x`, gate **J**) afin d'avoir une source unique autre que les fichiers Markdown.
- `15-3` En tant qu'équipe build, je veux marquer pour chaque story l'état des tests **TU → TI → contrat → E2E** afin de respecter la Definition of Done (`planning.md` §6).
- `15-4` En tant que super admin, je veux connecter le dépôt Git (GitHub / GitLab / Azure DevOps — URL, token, secret webhook) afin d'ingérer l'activité de développement.
- `15-5` En tant que système, je veux recevoir les **webhooks `push`** (et optionnellement merge PR) et persister commits, auteur, fichiers, message afin d'alimenter le reporting.
- `15-6` En tant que super admin, je veux mapper les auteurs Git (email / login) aux membres de l'équipe afin que les rapports nomment les bonnes personnes.
- `15-7` En tant que système, je veux extraire les IDs story (`NN-x`) et les **sections structurées** des commits (`Avancement:`, `delivery: statut-hebdo`, blocs Avancements / Objectifs / Goulots) afin d'alimenter le rapport MOA (`CONTRIBUTING.md`).
- `15-8` En tant que super admin, je veux configurer les **destinataires MOA**, l'envoi du **rapport formel le vendredi** et le **rappel aux devs le jeudi** (jour, heure, fuseau) afin de cadencer la communication.
- `15-9` En tant que destinataire MOA, je veux recevoir chaque **vendredi** un **email formel et professionnel** (synthèse, avancements de la semaine, objectifs en cours, objectifs semaine prochaine, goulots d'étranglement) rédigé à partir des messages de commit **sans jargon technique**, afin de suivre le projet sans accéder à Git.
- `15-10` En tant qu'admin groupe ou super admin, je veux consulter l'**historique des rapports** et les **prévisualiser** (corps MOA + annexe technique) in-app avant ou après envoi.
- `15-11` En tant que directeur groupe, je veux une vue exécutive (jalons, % stories done, prochaine gate) sans accès à la configuration Git.
- `15-12` En tant que développeur, je veux recevoir un **email de rappel le jeudi** m'invitant à compléter mon statut hebdo et mes lignes `Avancement:` avant l'envoi MOA du vendredi, avec lien vers `CONTRIBUTING.md`.
- `15-13` En tant que tech lead, je veux **relire et valider** le brouillon du rapport vendredi in-app avant envoi automatique aux destinataires MOA afin de garantir le ton et l'exactitude.

> **Intégration Git.** Webhook `POST /api/v1/core/delivery/webhooks/git`. Tâches planifiées : `delivery.tasks.send_weekly_dev_reminder` (**jeudi**), `delivery.tasks.send_weekly_digest` (**vendredi**). Templates : `delivery/weekly_dev_reminder`, `delivery/weekly_digest_moa` (corps formel) + annexe technique optionnelle. Conventions commits : **`CONTRIBUTING.md`**. Envoi via module `notifications`.

---

## 16 · Recueil des besoins de formation — *epic : campagne annuelle des filiales*

> **Module détachable, travail parallèle.** Se déploie et fonctionne **seul** (`docker-compose.needs.yml`), puis se raccorde à la plateforme par variables d'environnement. Hors chemin critique go-live — nœud **N** de `planning.md`. Remplace le recueil Academix (F10, F11) et le classeur HTML autonome.
> **Campagne cible : exercice 2027.** Spécification complète → **`docs/SPEC_RECUEIL_BESOINS_2027.md`**.

**Socle — R0**

- `16-1` En tant que directeur du centre, je veux **ouvrir une campagne** pour un exercice (libellé, date d'ouverture, date de clôture) afin que les filiales sachent quand et jusqu'à quand déclarer leurs besoins.
- `16-2` En tant qu'utilisateur, je veux me connecter au module **par le SSO**, sans compte ni mot de passe propres au module, afin qu'aucun identifiant ne soit géré ni stocké ici.
- `16-3` En tant que système, je veux appliquer **Cerbos en default-deny** sur chaque route et **filtrer le référentiel par query plan** afin qu'un manager ne reçoive jamais les lignes des marques qu'il ne gère pas.
- `16-4` En tant qu'administrateur, je veux **importer le référentiel de campagne** par **famille** (Techniques Motors / Equipment / Carrosserie, Process SAV et Parts Motors / Equipment) via le patron `00-9`, avec rapprochement sur `(famille, marque, code)`, marque **nullable** pour les lignes transverses et correction tracée des alias, afin de figer le catalogue avant l'ouverture.
- `16-5` En tant qu'administrateur, je veux qu'une famille dont le **catalogue n'est pas encore livré** reste au statut `PENDING` — visible dans la grille avec un bandeau « catalogue en préparation », non saisissable — afin d'ouvrir la campagne sans attendre le dernier catalogue.
- `16-6` En tant que manager de filiale, je veux saisir, pour chaque formation de mon périmètre, **l'effectif à former par trimestre (T1–T4) et le lieu souhaité (CFR ou filiale) par trimestre**, afin de déclarer un besoin complet en une seule grille.
- `16-7` En tant que manager, je veux que ma saisie soit **enregistrée côté serveur en continu** (brouillon) afin de ne rien perdre et de reprendre depuis un autre poste.
- `16-8` En tant que manager, je veux **filtrer et rechercher** dans la grille (famille, marque, niveau, public, texte libre) afin de retrouver une formation parmi plusieurs centaines.
- `16-9` En tant que manager, je veux **désigner les destinataires en copie** de la confirmation (ma hiérarchie, la RH filiale) au moment de soumettre, afin qu'ils soient informés une fois ma fiche validée.
- `16-10` En tant que manager, je veux **soumettre ma déclaration** après un récapitulatif (total collaborateurs, ventilation trimestrielle, répartition CFR / filiale) et suivre son état — « en cours de relecture par l'équipe Academy ».

**Circuit de validation des envois — R0**

> **Principe.** Aucun email ne part vers une filiale sans qu'un membre de l'équipe Academy l'ait validé dans la plateforme. Le seul envoi automatique est **interne** : un résumé + un lien.

- `16-11` En tant qu'équipe Academy, je veux recevoir à chaque soumission un **email interne de résumé** (totaux, filiale, auteur) avec un **lien profond vers la fiche**, groupé après 30 minutes d'inactivité, afin d'aller relire dans la plateforme plutôt que dans ma boîte mail.
- `16-12` En tant qu'équipe Academy, je veux **ouvrir une fiche soumise**, la relire, la corriger si besoin, puis **valider** ou **réouvrir avec motif obligatoire**, afin de ne confirmer que des chiffres exacts.
- `16-13` En tant qu'équipe Academy, je veux un écran **« À envoyer »** listant les messages en attente, avec **prévisualisation du rendu réel**, envoi **unitaire ou par lot** et rejet motivé, afin de garder la main sur ce qui sort.
- `16-14` En tant que système, je veux qu'à la validation d'une fiche la **confirmation parte à son auteur avec ses destinataires en copie**, afin que la filiale et sa hiérarchie soient informées d'un seul coup.
- `16-15` En tant que système, je veux **refuser le démarrage** si un type de message visant une adresse hors équipe Academy est configuré en envoi automatique, afin que le principe ne puisse pas être contourné par la configuration.

**Délégation et relances — R1**

- `16-16` En tant qu'assistante ou admin filiale, je veux **saisir ou importer les besoins au nom d'une filiale**, avec traçabilité de l'acteur réel, afin de ne pas dépendre de la connexion effective de chaque manager. *(leçon F11 : sur 92 managers, une partie ne se connectera pas — la voie déléguée fait partie du périmètre, pas du rattrapage)*
- `16-17` En tant qu'équipe Academy, je veux que le système **prépare** les relances des filiales silencieuses (J-21, J-10, J-3) puis l'**escalade au directeur de filiale** à J+1, et me les présente **en lot dans l'écran « À envoyer »** — chaque relance n'étant préparée qu'une fois. *(applique `14-13`, sous circuit de validation)*
- `16-18` En tant qu'administrateur, je veux **éditer les templates d'email de campagne**, les prévisualiser, consulter le **journal d'envoi** et **renvoyer** un message échoué. *(applique `14-12`, `14-16`)*
- `16-19` En tant qu'équipe Academy, je veux être alertée quand une fiche attend ma relecture **depuis plus de 48 heures**, afin que le circuit de validation ne devienne pas un goulot silencieux.

**Consolidation — R2**

- `16-20` En tant qu'équipe Academy, je veux un **tableau de bord de campagne** — filiales soumises, en relecture, en saisie, silencieuses ; totaux par famille, marque, trimestre et lieu — afin de piloter la collecte et de relancer utilement.
- `16-21` En tant qu'équipe Academy, je veux **exporter le consolidé** et la **synthèse par famille et par marque** en Excel afin d'alimenter le budget et l'arbitrage.
- `16-22` En tant que directeur du centre, je veux **arbitrer la répartition CFR / filiale** sur une règle explicite et auditable, afin que les décisions soient défendables devant les filiales. *(correctif F12 : la clé de répartition d'Academix vivait dans un fichier JSON hors base)*
- `16-23` En tant que système, je veux émettre **`needs_consolidated`** vers le module sessions afin que la planification d'ouverture parte du besoin réel. *(contrat figé dès R0, implémenté en R2 — `planning.md` §3)*

**Dépendance plateforme — hors module**

- `16-24` En tant qu'équipe plateforme, je veux **éclater `STELLANTIS`** en CITROEN, FIAT, JEEP et PEUGEOT dans `catalogues/training-catalog.json`, `catalogues/stellantis/` et les données du site, afin que le site et le module partagent le même référentiel de marques. *(l'éclatement est une nouveauté pour CFAO Academy aussi, pas seulement pour la campagne 2027)*
- `16-25` En tant qu'équipe plateforme, je veux **remplacer `OMODA & JAECCO` par `OMODA & JAECOO`** — orthographe de référence confirmée par le métier — dans les **15 fichiers** du dépôt qui portent encore la graphie fautive (`catalogues/training-catalog.json`, `frontend/src/data/`, utilitaires de marque, `Formations.jsx`, règles Cursor), afin qu'une seule graphie circule dans le produit. *(`JAECCO` reste un alias d'import, jamais une valeur stockée)*

> **Familles de catalogue.** Le référentiel n'est pas une liste de marques mais une liste de **familles** — Techniques Motors, Techniques Equipment, Techniques Carrosserie, Process SAV Motors, Process Parts Motors, Process SAV Equipment, Process Parts Equipment, plus Techniques Yamaha à venir. Seules certaines se déclinent par marque, et **les familles Process se déclinent aussi par marque** dans certains cas (`TP02` existe sur 10 marques, `X24017V` est propre à MERCEDES). Une ligne transverse a `marque = NULL`, jamais une pseudo-marque « TOUTES MARQUES ».

> **Éclatement des marques.** Stellantis n'existe plus : les besoins se déclarent sur **CITROEN, FIAT, JEEP, PEUGEOT** séparément — 10 marques Motors, 10 marques Equipment, plus YAMAHA à venir.

> **Ce que le module ne fait pas.** Ni session, ni inscription nominative, ni logistique voyage, ni compétence. Il produit un plan de besoins consolidé ; l'ouverture des sessions reste à l'app 08.

---

## Stories transverses (non rattachées à une app)

- `T-1` En tant qu'utilisateur, je veux me connecter via le SSO (Keycloak, puis Okta) afin d'accéder à mon portail.
- `T-2` En tant que système, je veux résoudre le périmètre 3D (org × département × marque) de chaque utilisateur afin de filtrer ce qu'il voit et peut faire.
- `T-3` En tant que système, je veux appeler Cerbos (check / query plan) sur chaque requête afin d'autoriser l'action et filtrer les listes.
- `T-4` En tant que système, lors d'une réorganisation org je veux propager `org_restructured` afin de recalculer les périmètres dénormalisés.