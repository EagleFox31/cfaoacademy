# Étude — référentiel des formations, droits et édition partagée (lot P1)

Lot « Référentiel et droits » du plan d'amélioration du 03/11/2026. Étude du 05/11/2026, rédigée avant tout
code. Module : `cfao-comptes-rendus/`. Décisions prises avec Ibrahim Mbowou le 05/11.

## 1. Besoin

| Demande | Décision retenue |
|---|---|
| Formations et participants préchargés | Base serveur alimentée par import du fichier « Liste des participants », avec correction à l'écran |
| Codes uniques, non modifiables par les formateurs | Le code appartient au référentiel ; seul l'administrateur le crée ou le corrige |
| Création des codes par des profils habilités | **Un seul profil administrateur** ; 2 comptes fictifs pour l'équipe de développement |
| Formation en lecture seule pour le formateur | Le formateur choisit sa session ; il ne modifie ni le code, ni le libellé, ni la liste des stagiaires |
| Sélection par formation, pays, marque | Filtres sur la liste des sessions |
| Statuts À faire / En cours / Terminé | Statut tenu par le serveur, avec un **% de complétion calculé** |
| Consultation par Claudia, André Yves, Laurent Gonin | Profil **lecteur** : consulte et télécharge tous les comptes rendus, sans modifier |

Règles métier confirmées :
- **Session = code de formation + dates.** Un compte rendu par session.
- Un stagiaire est identifié par **nom, prénom et pays** (pas de matricule).
- Un stagiaire n'est jamais retiré d'une session : il est **marqué absent**.
- Plusieurs formateurs par session ; tous écrivent dans **le même compte rendu**.
- Le formateur ne voit que ses sessions.
- Les comptes rendus déjà rédigés sont repris dans la nouvelle base.

## 2. Ce que montre le fichier Excel (analyse agrégée, sans nom)

179 sessions ; clé « N° de la formation » (`M34-2026`). Dix codes reviennent à plusieurs dates :

| Cas | Codes | Lecture |
|---|---|---|
| Mêmes stagiaires, semaines consécutives | E09, M34, M58, M115 | Une session par semaine, chacune avec son compte rendu (décidé le 06/11) |
| Stagiaires différents | M65, M66, M73, M114, M116, CE52 | Sessions distinctes d'une même formation |

Anomalies que l'import doit signaler : deux libellés à la même date (M16, M18), date de fin en 2028 (CE52),
libellés abrégés, ~90 graphies de pays, notes saisies entre 0 et 1.

## 3. Existant

| Élément | État | Fichier |
|---|---|---|
| Compte rendu | JSON opaque par propriétaire (`owner`, `ident`) | `api/comptes_rendus/models.py:10` |
| Enregistrement | Sans contrôle de contenu ; « le plus récent l'emporte » par date du navigateur | `api/comptes_rendus/views.py:230-243` |
| Sessions | 7 sessions de démonstration en dur | `web/src/data/mock_sessions_formateur.js` |
| Droits | trainer, ki, pic sur leurs propres comptes rendus ; superadmin sur tout | `cerbos/policies/resource_policies/compte_rendu.yaml` |
| Comptes locaux | `PROFILS_LOCAUX` + commande `compte_technique` | `core/auth/identity.py`, `management/commands/compte_technique.py` |
| Code modifiable | Bouton « Modifier les informations » | `web/src/components/compte-rendu/PhaseSession.jsx:141`, 218-224 |
| Import | Patron transverse d'import tabulaire (story 00-9) | `docs/PATRON_IMPORT_TABULAIRE.md` |

Conséquence : le compte rendu est lié à **une personne**, pas à une session. Il faut inverser ce lien.

## 4. Modèle de données proposé

| Table | Champs principaux | Règles |
|---|---|---|
| `Formation` | code (unique), libellé, marque, type | Créée et corrigée par l'administrateur seul |
| `Session` | formation, date de début, date de fin, lieu, pays, statut | Unique sur (code, début) ; 5 jours au plus : une semaine de plus est une autre session |
| `Stagiaire` | nom, prénom, pays | Doublon détecté sur (nom, prénom, pays) normalisés |
| `Inscription` | session, stagiaire, absent (oui/non) | Jamais supprimée : marquée absente |
| `Animation` | session, formateur (identifiant de connexion) | Plusieurs formateurs par session |
| `CompteRendu` | session (unique), contenu JSON, révision, modifié par, modifié le | Un seul par session |
| `HistoriqueCompteRendu` | compte rendu, révision, auteur, date, champs modifiés (avant, après) | Ajout seul : jamais modifié ni supprimé, y compris par l'administrateur |
| `Verrou` | compte rendu, détenteur, pris le, dernier signe de vie, dernière saisie | Voir § 6 |
| `ImportReferentiel` | fichier, auteur, date, rapport, état (essai / appliqué) | Trace de chaque import |

Le contenu du compte rendu reste en JSON (pas de refonte du parcours dans ce lot). Le code, le libellé et la
liste des stagiaires sont **lus dans le référentiel**, plus dans le JSON : le formateur ne peut plus les altérer.

## 5. Profils et droits (Cerbos, refus par défaut)

| Action | Formateur | Lecteur | Administrateur | Équipe technique |
|---|---|---|---|---|
| Voir la liste des sessions | Les siennes | Toutes | Toutes | Toutes |
| Lire, télécharger un compte rendu | Les siens | Tous | Tous | Tous |
| Écrire dans un compte rendu | Ses sessions, verrou détenu | Non | Non | Non |
| Marquer un stagiaire absent | Ses sessions | Non | Oui | Non |
| Créer, corriger formations, sessions, stagiaires | Non | Non | Oui | Non |
| Importer le fichier Excel | Non | Non | Oui | Non |
| Libérer un verrou à la main | Non | Non | Oui | Oui |

- Nouveaux rôles : `admin_referentiel`, `lecteur_cr`. Ressources Cerbos : `session_formation`, `referentiel`,
  `compte_rendu` (revue : le lien passe du propriétaire à la liste des formateurs de la session).
- **Tests négatifs obligatoires** : formateur sur une session qui n'est pas la sienne ; lecteur qui écrit ;
  formateur qui importe ou modifie un code ; anonyme partout ; écriture sans verrou.
- Comptes : 2 comptes fictifs administrateur pour l'équipe de développement (`admin.dev1`, `admin.dev2`), créés
  par une commande sur le modèle de `compte_technique` ; mot de passe fourni par variable d'environnement, aucun
  par défaut. Le compte de l'administrateur réel sera ajouté à la mise en service.

## 6. Édition partagée sans collision ni blocage

Choix : **verrou pessimiste à durée de vie courte**, doublé d'un **contrôle de révision** à l'enregistrement.

| Situation | Comportement |
|---|---|
| Ouverture en écriture | Le formateur prend le verrou ; les autres voient « En cours de modification par X depuis 10 h 12 », en lecture seule |
| Page ouverte et active | Signe de vie toutes les 30 s |
| Onglet fermé, plantage, coupure | Plus de signe de vie : verrou libéré après **2 min** |
| Page ouverte sans saisie | Après **15 min** sans frappe : enregistrement, puis libération ; bouton « Reprendre l'édition » |
| Verrou libéré pendant qu'un autre écrit | Le premier repasse en lecture seule, sans perte : son dernier état est enregistré |
| Exception | L'administrateur libère le verrou à la main (tracé) |
| Filet de sécurité | Un enregistrement fondé sur une révision plus ancienne est refusé (409), avec copie locale conservée |
| Traçabilité | Chaque enregistrement ajoute une ligne à l'historique : qui, quand, quels champs, avant et après. Personne ne peut nier une modification |

Options écartées :

| Option | Pour | Contre |
|---|---|---|
| Dernier enregistrement gagnant (actuel) | Rien à faire | Écrase le travail d'un collègue sans le dire |
| Contrôle de révision seul | Simple, jamais de blocage | Le second formateur découvre le conflit après avoir écrit |
| Édition simultanée (fusion en temps réel) | Pas d'attente | Lourd (CRDT, WebSocket), disproportionné pour 2 à 3 formateurs |
| **Verrou court + révision** | Pas de collision, pas de blocage durable | Signe de vie à gérer côté navigateur |

Les durées (30 s, 2 min, 15 min) sont des réglages serveur, ajustables sans code.

## 7. % de complétion

Calculé par le serveur à chaque enregistrement, à partir du contenu :

| Bloc | Poids | Complet quand |
|---|---|---|
| Informations de session | 10 % | Référentiel rattaché (toujours vrai après migration) |
| Notes | 30 % | Les 3 épreuves saisies et valides pour chaque stagiaire présent |
| Objectifs | 15 % | Texte et au moins une photo |
| Journées | 25 % | Chaque jour : thématiques et photos |
| Appréciations | 20 % | Commentaire pour chaque stagiaire présent et bilan général |

Statut : **À faire** (0 %), **En cours** (1 à 99 %), **Terminé** (100 % et validé par le formateur). Les
absents ne comptent pas. Pondération proposée, à confirmer avec Jennifer Lawrynn.

## 8. Import du fichier « Liste des participants »

1. L'administrateur dépose le fichier.
2. **Essai à blanc** : rapport à l'écran (sessions à créer, à mettre à jour, inchangées ; anomalies).
3. Correction à l'écran, puis **application**. Rien n'est écrit avant.
4. Une session de plus de 5 jours est signalée comme anomalie : chaque semaine forme sa propre session.
5. Réimport : met à jour sans dupliquer (clé session = code + début ; stagiaire = nom + prénom + pays) ; un
   stagiaire disparu du fichier est **signalé**, jamais retiré.

Colonnes lues : N° de la formation, Désignation, Marques, Animateurs, Dates de début et de fin, Lieu, Noms,
Prénoms, Pays, Présence. Les colonnes de frais, de vols et d'hébergement sont ignorées. Pays normalisés par
une table de correspondance.

## 9. Reprise des comptes rendus existants

Commande `reprendre_comptes_rendus`, en deux temps :

| Étape | Effet |
|---|---|
| `--essai` (par défaut) | N'écrit rien. Rapport : pour chaque brouillon, la session trouvée (par code et dates), le formateur rattaché, les stagiaires reconnus, ou la raison de l'échec |
| Correction | L'administrateur rattache à l'écran les brouillons non reconnus |
| `--appliquer` | Crée les `CompteRendu`, relie les stagiaires, garde le JSON d'origine intact |
| Retour arrière | Les `Brouillon` d'origine ne sont ni modifiés ni supprimés ; une table de correspondance permet d'annuler |

Cas particuliers : deux brouillons pour la même session (deux formateurs) → aucun choix automatique : rapport et
choix de l'administrateur. Brouillon sans code reconnu → reste consultable par son auteur, marqué « à rattacher ».

Procédure de production : sauvegarde du volume, essai sur une copie (`demarrer-module.ps1 -essai`), lecture du
rapport, puis application en production sur go explicite.

## 10. Impacts

| Domaine | Impact |
|---|---|
| Données | 9 tables nouvelles, migrations Django réversibles ; `Brouillon` conservé |
| Sécurité | 2 rôles, 3 ressources Cerbos, tests négatifs ; import réservé à l'administrateur ; fichier non conservé après import |
| Navigateur | Liste des sessions depuis l'API (fin de la liste de démonstration) ; code en lecture seule ; signe de vie ; bandeau de verrou ; écran administrateur (import, corrections) ; écran lecteur |
| Hors ligne | La copie locale reste, mais l'écriture sans verrou est refusée au retour en ligne : on propose de la reprendre |
| Performance | Signe de vie toutes les 30 s par formateur actif : négligeable |
| Déploiement | Migration puis reprise des comptes rendus, sur copie d'abord |

## 11. Risques

| Risque | Parade |
|---|---|
| Rattachement erroné d'un ancien compte rendu | Essai à blanc, rapport, choix manuel ; aucune fusion automatique |
| Homonymes (même nom, prénom et pays) | Signalés à l'import ; l'administrateur tranche |
| Formateur bloqué par un verrou oublié | Libération automatique 2 min et 15 min ; libération manuelle |
| Excel qui évolue (colonnes renommées) | Colonnes repérées par leur titre ; import refusé avec message si une colonne clé manque |
| Données réelles en test | Tests sur fichier fictif uniquement |

## 12. Points à trancher

1. Pondération du % de complétion (§ 7) : à valider avec Jennifer Lawrynn.
2. Durées du verrou (2 min, 15 min) : défaut proposé.
3. ~~Regroupement des semaines~~ : tranché le 06/11, une session par semaine, chacune avec son compte rendu.

## 13. Étapes

1. Modèles, migrations, admin des tables (tests).
2. Rôles et policies Cerbos, tests positifs et négatifs ; 2 comptes administrateur fictifs.
3. API sessions (liste filtrée par profil, filtres pays, marque, formation) et compte rendu par session.
4. Verrou, contrôle de révision et historique des modifications (API, tests de concurrence).
5. Import Excel : essai, rapport, application (tests sur fichier fictif).
6. Navigateur : liste des sessions, code en lecture seule, bandeau de verrou, % et statut.
7. Écrans administrateur et lecteur.
8. Reprise des comptes rendus existants : commande, essai sur copie, rapport.
