# CFAO Academy — Applications & Matrice d'accès

> Légende : **R** = lecture · **W** = écriture · **RW** = les deux · **—** = aucun accès

> **Rôles cumulables.** Un même compte peut cumuler plusieurs affectations (ex. `learner` + `ki` + `team_manager`). Les accès ci-dessous s'**additionnent** : voir la ligne de chaque rôle porté par l'utilisateur. Détail des cumuls courants et incompatibilités → `PLATFORM_ROLES.md` §5.

---

## 01 · Site public
*Catalogue, sessions, actualités, contact. Accessible sans connexion.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Tous (non connecté) | Catalogue formations, sessions, actualités, formulaire contact | R |
| Tout profil connecté | Idem + accès au portail selon rôle | R |

---

## 02 · Espace Apprenant — LMS
*Parcours personnel, modules e-learning, évaluations, attestations, certifications.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Apprenant | Voir ses modules, compléter évaluations, télécharger attestations, suivre progression | RW |
| KI / PIC | **Casquette apprenant** (obligatoire) : plan de formation personnel, mesure de compétences, modules, attestations, progression — comme tout technicien | RW |
| Formateur | Consulter les contenus qu'il a dispensés | R |
| Chef d'équipe | Progression de son équipe (marques assignées, agence) | R |
| Chef d'atelier | Progression de toutes ses équipes (agence + marques) | R |
| DPS / DOP | Vue avancement département, agence/filiale | R |
| Assistante centre | Vue globale pour suivi administratif | R |
| Directeur centre | Vue globale tous apprenants | R |
| Admin / RH Filiale | Dossiers formation de tous les collaborateurs filiale | R |
| Admin / RH Groupe | Idem, périmètre groupe | R |
| Directeur Filiale / Régional / Groupe | Vue consolidée selon périmètre org | R |
| Super Admin | Tout + modifications administratives | RW |

**Scope :** agence + marques pour `learner` ; filiale + marque certifiée pour KI/PIC (formateur suppléant) ; agence + marques pour les chefs. Un KI/PIC cumule **deux lignes** dans la matrice : Apprenant + KI/PIC.

---

## 03 · Espace KI / PIC — formateur suppléant
*Suivi des apprenants de niveau inférieur, saisie évaluations terrain, validation compétences. Formations dispensables dérivées du catalogue marque + niveau de certification du KI/PIC.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| KI | Voir ses apprenants assignés, liste des **formations à dispenser** (niveaux inférieurs, sa marque), saisir évaluations, valider compétences terrain | RW |
| PIC | Idem (réseau partenaire) | RW |
| Chef d'atelier | Voir les KI/PIC de son atelier et leurs apprenants | R |
| Formateur | Voir les KI/PIC qui assistent ses sessions | R |
| Directeur centre | Vue globale KI/PIC actifs | R |
| Admin Filiale | Liste KI/PIC de la filiale, habilitations | R |
| Super Admin | Tout | RW |

**Scope :** **filiale** + **marque certifiée** — un KI Toyota filiale Cameroun ne voit et ne forme que des apprenants Toyota de cette filiale, pour les niveaux strictement inférieurs au sien. Cumul typique : `learner` + `ki` → apps 02 et 03.

---

## 04 · Espace Formateur
*Planning sessions, contenus pédagogiques, feuilles d'émargement, évaluations, rapports de formation. Formateurs constructeur (`trainer`) — distincts des KI/PIC formateurs suppléants.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Formateur (`trainer`) | Ses sessions Academy à animer, contenus, émargements, évaluation stagiaires, rapport post-formation | RW |
| KI / PIC | Sessions **internes** qu'ils animent en formateur suppléant ; consulter contenus pédagogiques de référence | RW (leurs sessions internes) + R (catalogue) |
| Assistante centre | Planning formateurs, affectations logistiques | RW |
| Directeur centre | Validation contenus, affectation sessions, supervision | RW |
| Admin Filiale | Liste des formations dispensées dans la filiale | R |
| Super Admin | Tout | RW |

**Scope :** Formateur = scope flottant multi-agences selon affectation session.

---

## 05 · Planning & Réservation de salles
*Réservation salles, ateliers, équipements du centre Academy. Gestion créneaux, capacité, matériel pédagogique.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Formateur | Réserver des créneaux pour ses sessions, voir planning général | RW |
| KI / PIC | Réserver espaces pour sessions internes | RW |
| Assistante centre | Gestion complète du planning, arbitrage conflits | RW |
| Directeur centre | Validation, modifications, vue d'ensemble | RW |
| Chef d'atelier | Voir créneaux d'occupation de l'atelier | R |
| Admin Filiale | Vue planning filiale | R |
| Super Admin | Tout | RW |

---

## 06 · Assistance Formateurs
*Système de tickets — demandes logistiques, pédagogiques ou techniques. Traitement par équipe Academy.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Formateur | Créer tickets, suivre résolution, clore | RW |
| KI / PIC | Créer demandes (logistique, matériel) | RW |
| Assistante centre | Traiter tickets, répondre, affecter, clore | RW |
| Directeur centre | Supervision, escalade, validation tickets prioritaires | RW |
| Admin Filiale | Voir tickets en cours pour la filiale | R |
| Super Admin | Tout | RW |

---

## 07 · Tableau de bord Management
*KPIs équipe, taux de certification, avancement parcours, sessions à venir. Filtré par périmètre org.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| KI / PIC | Mini-dashboard : progression de leurs apprenants + leur propre avancement (casquette `learner`) | R |
| Chef d'équipe | Son équipe — certifications, sessions, avancement (agence + marques) | R |
| Chef d'atelier | Toutes ses équipes — agence, marques assignées | R |
| DPS | Département pièces/SAV — agence ou filiale | R |
| DOP | Toutes opérations — filiale | R |
| Directeur Filiale | Filiale complète, tous départements | R |
| Directeur Régional | Toutes filiales de sa région | R |
| Directeur Groupe | Vue groupe entier | R |
| RH Filiale | Formation et certification collaborateurs filiale | R |
| RH Groupe | Idem, périmètre groupe | R |
| Formateur | Stats de ses sessions (taux succès, certifications délivrées) | R |
| Directeur centre | Performance globale Academy, productivité formateurs | R |
| Admin Filiale | Vue filiale (support analytique) | R |
| Admin Groupe | Vue groupe (support analytique) | R |
| Super Admin | Tout + configuration des KPIs | RW |

---

## 08 · Gestion des Sessions
*Création, modification, ouverture des inscriptions, suivi présences, résultats.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Assistante centre | Création/modification sessions, ouverture inscriptions, listes stagiaires | RW |
| Directeur centre | Validation, annulation, modifications majeures | RW |
| Formateur | Voir ses sessions, saisir présences et résultats | R + W (ses sessions) |
| Admin Filiale | Inscrire des collaborateurs de la filiale | RW |
| RH Filiale | Inscrire des collaborateurs | RW |
| Chef d'atelier | Proposer des inscriptions pour son équipe | W (propositions) |
| KI / PIC | Voir les sessions disponibles pour leurs apprenants | R |
| Admin Groupe | Vue globale, modifications exceptionnelles | RW |
| Directeur Filiale / Régional / Groupe | Vue des sessions dans leur périmètre | R |
| Super Admin | Tout | RW |

---

## 09 · Recrutement & Évaluation Candidats
*Dossiers candidats, évaluations techniques par marque, décisions, bascule vers rôle terrain.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Candidat | Compléter son dossier, passer évaluations assignées, voir ses résultats | RW |
| RH Filiale | Créer dossiers, assigner évaluations (par marque), suivre, décider | RW |
| RH Groupe | Vue globale recrutements, benchmarks inter-filiales | RW |
| Directeur Filiale | Validation finale recrutements, vue synthèse | R |
| Chef d'atelier | Résultats évaluations techniques pour candidats de son département | R |
| Formateur | Saisir résultats évaluations techniques marque (correcteur) | W (évaluations) |
| Admin Filiale | Liste candidatures en cours | R |
| Super Admin | Tout + configuration évaluations | RW |

**Note :** à l'embauche, le compte candidat est promu vers le rôle terrain assigné (bascule automatique).

---

## 10 · Reporting Formation
*Analytics consolidés — certifications, heures, taux, progression par périmètre org et marque.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Chef d'équipe | Son équipe — agence + marques | R |
| Chef d'atelier | Son atelier — agence + marques | R |
| DPS / DOP | Département, agence ou filiale | R |
| Directeur Filiale | Filiale entière | R |
| Directeur Régional | Région (N filiales) | R |
| Directeur Groupe | Groupe entier | R |
| RH Filiale | Collaborateurs filiale — formation et certification | R |
| RH Groupe | Groupe entier | R |
| Formateur | Ses propres sessions — résultats et certifications | R |
| Directeur centre | Vue Academy complète, efficacité pédagogique | R |
| Admin Filiale | Filiale (support reporting) | R |
| Admin Groupe | Groupe (support reporting) | R |
| Super Admin | Tout + export, configuration rapports | RW |

**Scope :** chaque profil ne voit que les données de son périmètre org × marques.

---

## 11 · Administration RH & Comptes
*Gestion collaborateurs, rôles, scopes org/département/marque, historiques.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Admin Filiale | Créer/modifier comptes filiale, assigner rôles, scopes agence/dept/marques | RW |
| RH Filiale | Consulter dossiers formation, mettre à jour infos RH (pas les rôles techniques) | R + W (champs RH) |
| Directeur Filiale | Consulter liste collaborateurs et formations | R |
| Admin Groupe | Toutes filiales, structure org, rôles Admin Filiale | RW |
| RH Groupe | Dossiers formation tous collaborateurs | R + W (champs RH) |
| Directeur centre | Comptes formateurs et équipe Academy | RW |
| Assistante centre | Inscriptions, convocations, dossiers administratifs formation | R + W (formation) |
| Super Admin | Tout y compris configuration avancée des droits | RW |

---

## 12 · Administration Plateforme
*Structure org (groupe/région/filiale/agence/département/marque), rôles système, logs, configuration.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Admin Groupe | Créer/modifier filiales, agences, départements, marques assignées | RW |
| Directeur centre | Vue configuration de l'espace Academy | R |
| Super Admin | Tout — rôles système, logs d'audit, configuration globale, branding, intégrations | RW |

---

## 15 · Pilotage projet & reporting delivery
*Suivi de l'évolution de la plateforme (build, migration, releases) — cockpit MOA / équipe technique. **Reporting Git** : agrégation des push et envoi **hebdomadaire par email** aux destinataires configurés.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Super Admin | Connexion dépôt Git, webhooks, mapping auteurs, destinataires du digest, roadmap, gate migration, historique des rapports | RW |
| Admin Groupe *(MOA / sponsor)* | Vue roadmap, phases PERT, avancement epics, derniers rapports hebdo (sans config Git) | R |
| Équipe build *(comptes techniques dédiés)* | Backlog vivant, statut tests TU→E2E par story, checklist gate **J**, preview du prochain digest | RW |
| Directeur Groupe | Synthèse exécutive : jalons, % avancement, risques (vue agrégée) | R |

**Fonctionnalités clés**

| Domaine | Contenu |
|---------|---------|
| **Roadmap & backlog** | Epics 00–15, stories, statuts ; lien optionnel vers `backlog.md` / outil externe (import) |
| **Planification** | Phases MVP → Release, dépendances PERT (`planning.md`), chemin critique |
| **Migration & go-live** | Lots `00-x`, critères gate **J**, smoke `00-7` |
| **Qualité delivery** | Par story : TU / TI / contrat / E2E (cf. `planning.md` §6) |
| **Git → reporting** | Réception des **push** (webhook GitHub / GitLab / Azure DevOps) ; agrégation commits, auteurs, fichiers, PR mergées sur la semaine |
| **Digest hebdomadaire** | Email **formel MOA** le **vendredi** : avancements, objectifs, objectifs semaine prochaine, goulots — agrégés depuis les commits (`Avancement:` + `delivery: statut-hebdo`) ; **rappel jeudi** aux devs pour compléter avant envoi |

**Conventions Git** : voir `CONTRIBUTING.md` — sujet `NN-x`, ligne `Avancement:` (français, non technique), commit hebdo `delivery: statut-hebdo YYYY-Www` avec sections Avancements / Objectifs / Goulots ; **rappel jeudi**, **rapport MOA vendredi**.

**Scope :** accès **groupe / projet** uniquement — pas de filiale ni marque ; réservé aux profils pilotage (pas les apprenants ni le terrain).

---

## 16 · Recueil des besoins de formation
*Campagne annuelle : chaque filiale déclare, par marque et par trimestre, combien de collaborateurs former et où. **Module détachable** — se déploie et fonctionne seul, puis se raccorde à la plateforme. Campagne cible : exercice **2027**.*

| Profil | Fonctionnalité | Accès |
|--------|---------------|-------|
| Chef d'équipe / Chef d'atelier | Saisir les effectifs à former par trimestre et le lieu souhaité sur ses marques, désigner les destinataires en copie, soumettre | RW |
| DPS / DOP | Consolider et relire les besoins de son département avant soumission | R + W (département) |
| Directeur Filiale | Relire sa filiale ; **destinataire en copie** de la confirmation | RW |
| Admin Filiale / RH Filiale | **Saisie déléguée** au nom d'un manager, import du classeur de la filiale | RW |
| Assistante centre | **Relire et valider les fiches**, approuver les envois, relancer, saisir à la place | RW |
| Directeur centre | Idem + ouvrir et clôturer la campagne, arbitrer la répartition CFR / filiale | RW |
| Admin Groupe / Directeur Groupe / RH Groupe | Vue consolidée, exports | R |
| Super Admin | Tout, y compris import du référentiel de campagne | RW |

**Fonctionnalités clés**

| Domaine | Contenu |
|---------|---------|
| **Campagne** | Exercice, dates d'ouverture et de clôture, états `DRAFT → OPEN → CLOSED → ARBITRATED` |
| **Référentiel** | Import par **famille** — clé `(famille, marque, code)`, **jamais `code` seul** ; familles au statut `PENDING` tant que leur catalogue n'est pas livré |
| **Saisie** | Grille par formation : effectif **T1–T4** + lieu **CFR / Filiale** par trimestre, brouillon serveur permanent |
| **Délégation** | Saisie et import au nom d'une filiale, acteur réel tracé |
| **Circuit de validation** | Soumission → **résumé interne à l'équipe Academy** (+ lien) → relecture dans la plateforme → validation → **confirmation à l'auteur avec ses CC** |
| **Emailing** | File « À envoyer » avec prévisualisation et approbation par lot, templates versionnés et localisés, journal d'envoi avec renvoi, relances J-21 / J-10 / J-3 et escalade J+1 **préparées, pas expédiées** |
| **Consolidation** | Tableau de bord campagne, exports consolidé et par famille / marque, arbitrage CFR / filiale |

> **Aucun email ne part vers une filiale sans validation de l'équipe Academy.** Le seul envoi automatique est **interne** : un résumé de la fiche et un lien profond vers la plateforme. Un type de message visant une adresse externe configuré en envoi automatique **fait échouer le démarrage**.

**Familles de catalogue.** Le référentiel n'est pas une liste de marques mais une liste de **familles** : Techniques Motors, Techniques Equipment, Techniques Carrosserie, Process SAV Motors, Process Parts Motors, Process SAV Equipment, Process Parts Equipment — plus Techniques Yamaha à venir. **Les familles Process se déclinent aussi par marque** dans certains cas. Une ligne transverse a `marque = NULL`, jamais une pseudo-marque « TOUTES MARQUES ».

**Marques.** Stellantis n'existe plus : les besoins se déclarent sur **CITROEN, FIAT, JEEP, PEUGEOT** séparément — 10 marques Motors, 10 marques Equipment, plus YAMAHA à venir.

**Scope :** filiale × marques assignées pour les saisisseurs ; filiale entière pour le directeur ; groupe pour l'équipe Academy. Un manager habilité `peugeot` voit les lignes PEUGEOT **plus** les lignes sans marque de son pôle — filtrage par **query plan Cerbos**, jamais côté front.

> Spécification : **`docs/SPEC_RECUEIL_BESOINS_2027.md`** · Stories : `backlog.md` §16 · Planification : `planning.md` §2 nœud **N**

---

## Synthèse — Qui accède à quoi

> Les lignes sont **cumulatives** par personne. Ex. un chef d'atelier KI Toyota : union de « Chef atelier » + « KI/PIC » + « Apprenant » (via `learner`).

| | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 15 | 16 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Candidat | R | — | — | — | — | — | — | — | RW | — | — | — | — | — |
| Apprenant | R | RW | — | — | — | — | — | — | — | — | — | — | — | — |
| KI / PIC *(cumule `learner`)* | R | RW | RW | RW† | RW | RW | R | R | — | — | — | — | — | — |
| Chef équipe | R | — | — | — | — | — | R | W | — | R | — | — | — | **RW** |
| Chef atelier | R | — | R | — | R | — | R | W | R | R | — | — | — | **RW** |
| DPS / DOP | R | — | — | — | — | — | R | — | — | R | — | — | — | **R+W** |
| Formateur | R | R | R | RW | RW | RW | R | R+W | W | R | — | — | — | — |
| Assistante centre | R | R | — | RW | RW | RW | — | RW | — | — | R+W | — | — | **RW** |
| Dir. centre | R | R | R | RW | RW | RW | R | RW | — | R | RW | R | — | **RW** |
| Admin Filiale | R | R | R | R | R | R | R | RW | R | R | RW | — | — | **RW** |
| RH Filiale | R | R | — | — | — | — | R | RW | RW | R | R+W | — | — | **RW** |
| Dir. Filiale | R | R | — | — | — | — | R | R | R | R | R | — | — | **RW** |
| Dir. Régional | R | R | — | — | — | — | R | — | — | R | — | — | — | **R** |
| Admin Groupe | R | R | — | — | — | — | R | RW | — | R | RW | RW | R | **R** |
| RH Groupe | R | R | — | — | — | — | R | — | RW | R | R+W | — | — | **R** |
| Dir. Groupe | R | R | — | — | — | — | R | — | — | R | — | — | R | **R** |
| Partenaire B2B | R | RW | — | — | — | — | — | — | — | — | — | — | — | — |
| Super Admin | R | RW | RW | RW | RW | RW | RW | RW | RW | RW | RW | RW | RW | RW |
| Équipe build *(compte technique)* | — | — | — | — | — | — | — | — | — | — | — | — | RW | — |

† KI/PIC : RW app 04 limité aux **sessions internes** animées en formateur suppléant (pas l'espace formateur constructeur complet).

> **App 15** : hors périmètre formation ; accès MOA / build / super admin. Le digest hebdo Git est **opt-in par liste de destinataires** (emails ou comptes), configuré dans l'app — indépendant des notifications métier app 14.
