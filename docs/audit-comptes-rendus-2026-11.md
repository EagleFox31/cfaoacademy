# État des lieux — CFAO Academy, comptes rendus (lot P0)

Réponse au plan d'amélioration du 03/11/2026. Audit du code au 05/11/2026 (branche `feature/04-5-amelioration`),
sans exécution sur les données réelles. Responsable de tous les lots : Ibrahim Mbowou.

Chaque demande du plan est classée **livrée** (fonctionne de bout en bout), **partielle** (existe avec des manques
ou des défauts) ou **absente**.

## 1. Synthèse

| | Livrées | Partielles | Absentes | Total |
|---|---|---|---|---|
| Demandes | 8 | 15 | 10 | 33 |

Points d'attention :
- **Pas de référentiel côté serveur.** Les formations, les participants et les codes viennent d'une liste de
  démonstration intégrée à l'application. Le serveur enregistre le compte rendu tel que le navigateur l'envoie,
  sans aucun contrôle.
- **Calculs incohérents quand le barème est modifié.** Les indicateurs en haut de la page des notes gardent le
  barème par défaut (30/30/20), alors que les lignes du tableau et le rapport utilisent le barème modifié.
- **Une note peut être altérée à la saisie.** « 12,5 » est enregistré comme « 125 ». Un dépassement du barème
  n'affiche pas de message, et la note finale est calculée quand même. Une note finale tirée d'une seule
  épreuve n'est pas signalée.
- **Le seuil de 70 % est écrit en dur à plusieurs endroits.** Le seuil propre à chaque formation est ignoré.
- **Absents :** filtres, codes uniques et verrouillés, rôle habilité, formulations proposées, appréciations
  croisées, génération en lot.

## 2. Suivi par lot

| Lot | Statut | Réalisé | Date estimée | Blocages | Preuve |
|---|---|---|---|---|---|
| P0 Audit et cadrage | En validation | 100 % | 06/11 | Décisions ci-dessous | Ce document |
| P1 Référentiel et droits | Étude faite | 25 % | 20/11 | Décision 11 | Étude `etude-referentiel-formations.md` |
| P1 Évaluations et progression | Cadré | 50 % | 13/11 | Décision 3 (barème, progression) | Audit, section E |
| P2 Saisie guidée et appréciations | Cadré | 40 % | 27/11 | Validation des formulations | Audit, section S |
| P2 Synthèse et rapports | Non démarré | 70 % | 03/12 | Décisions 5, 6 | Audit, annexe P |
| P3 Ergonomie et recette | Non démarré | 20 % | 08/12 | Retrait d'éléments après validation | Audit, annexe U |

Le « réalisé » compte une demande livrée pour 1 et une demande partielle pour ½. Il mesure l'existant, pas le
travail du plan.

**Réserve sur l'ordre.** Je propose de traiter les évaluations avant le référentiel. L'écart sur les chiffres
existe déjà dans les rapports produits, et la correction est courte. Le référentiel, lui, dépend de décisions
encore ouvertes. Avec cet ordre, la fin se situe au 08/12 au lieu du 27/11 : le référentiel demande une
nouvelle base côté serveur, des droits et un import, qui n'existent pas aujourd'hui.

## 3. Décisions attendues

Décisions déjà prises le 05/11 pour le référentiel (détail : `docs/etude-referentiel-formations.md`) :
- Source : import du fichier « Liste des participants », avec correction à l'écran.
- **Un seul administrateur** tient la base (codes, libellés, stagiaires, formateurs).
- Claudia, André Yves et Laurent Gonin **consultent et téléchargent** tous les comptes rendus, sans modifier.
- Le formateur ne voit que ses sessions. Plusieurs formateurs partagent **un seul compte rendu par session**,
  avec une réservation en écriture qui se libère seule (fermeture, inactivité) : ni collision, ni blocage.
- **Session = code + dates.** Un même code peut couvrir plusieurs sessions (groupes différents). Le 06/11 :
  un même groupe sur plusieurs semaines forme une session par semaine, chacune avec son compte rendu.
- Chaque modification d'un compte rendu est gardée dans un **historique** (qui, quand, avant, après) que
  personne ne peut effacer.
- Stagiaire identifié par nom, prénom et pays (pas de matricule) ; un absent est marqué, jamais retiré.
- Un **% de complétion** est calculé et affiché sur chaque compte rendu.
- Les comptes rendus existants sont repris dans la nouvelle base, après un essai à blanc et un rapport.

Décisions encore attendues :

1. ~~Source unique des formations et des participants~~ : tranchée (import du fichier).
2. ~~Profils habilités~~ : tranchée (un administrateur ; trois lecteurs, tous périmètres).
3. Barème et formules définitifs : notes sur 30/30/20 ? Seuil de 70 % ? Note finale quand une épreuve manque ?
   **Progression, à clarifier avec les formateurs.** Aujourd'hui, elle est calculée par rapport à la note
   d'entrée : passer de 10/30 à 20/30 donne +100 %, et rien n'est affiché si la note d'entrée vaut 0. Proposition :
   un écart en points, rapporté au barème. Le même exemple donne alors +10 points, soit +33 %.
4. ~~Appréciations croisées~~ : tranchée le 06/11 (une seule appréciation de la formation, voir S).
5. Lot de 25 rapports : un seul fichier ou 25 fichiers ?
6. Photos repositionnables : recadrage dans la case (existe) ou placement libre sur la page ?
7. ~~Ordre du parcours~~ : tranchée le 06/11 (administration → objectifs → journées → évaluations).
8. ~~Plafond de 5 jours~~ : tranchée le 06/11 (5 jours par session, certification comprise).
9. ~~Un code, plusieurs groupes ou dates~~ : tranchée (session = code + dates).
10. ~~Matricule~~ : tranchée (nom, prénom, pays).
11. Pondération du % de complétion (proposition dans l'étude, § 7).

## 4. Détail par demande

### R — Référentiel et droits
| Demande | Statut | Constat |
|---|---|---|
| Formations préchargées | Partielle | Liste de démonstration de 7 formations ; saisie manuelle possible |
| Participants préchargés | Partielle | Liste de démonstration, ajout et retrait possibles ; pas de source réelle |
| Codes uniques | Absente | Le code est un simple texte, sans contrôle |
| Codes non modifiables par les formateurs | Absente | Le bouton « Modifier les informations » rend le code modifiable |
| Sélection par formation, pays, marque | Absente | Liste de cartes, sans filtre |
| Statuts À faire / En cours / Terminé | Partielle | Badges présents, mais libellés différents selon l'écran ; statut non enregistré sur le serveur |
| Création des codes par profils habilités | Absente | Ni rôle dédié ni autorisation serveur |
| Formation en lecture seule pour le formateur | Partielle | Lecture seule par défaut, contournable par le bouton de modification |

Prévu (étude du 05/11, `etude-referentiel-formations.md`) :
- **Une base des formations côté serveur.** Une session correspond à un code et des dates. Elle regroupe ses
  stagiaires (nom, prénom, pays ; un absent est marqué, jamais retiré) et ses formateurs. Chaque session a
  **un seul compte rendu**.
- **Alimentation de la base :**
  - import du fichier « Liste des participants » ;
  - essai à blanc et rapport avant tout enregistrement ;
  - une session de plus de 5 jours signalée : chaque semaine forme sa propre session ;
  - correction à l'écran par l'administrateur.
- **Droits contrôlés par le serveur :**
  - l'administrateur tient la base ;
  - le formateur ne voit que ses sessions et ne peut pas modifier le code ;
  - les lecteurs consultent et téléchargent.
- **Écriture à plusieurs sans conflit.** Le compte rendu est réservé pendant la saisie et libéré
  automatiquement : à la fermeture, ou après une inactivité.
- **Historique strict.** Chaque enregistrement garde l'auteur, l'heure et les valeurs avant et après.
  L'historique ne peut être ni modifié ni effacé, même par l'administrateur.
- **Avancement.** Un % de complétion et un statut enregistré sur le serveur. Les comptes rendus existants
  sont repris dans la nouvelle base.

### E — Évaluations et progression
| Demande | Statut | Constat |
|---|---|---|
| Trois tests distincts | Livrée | Entrée, théorie finale, pratique ; repris dans le rapport |
| Barèmes visibles | Livrée | Affichés et modifiables par compte rendu |
| Progression en points et en % | Partielle | En % seulement ; rien si la note d'entrée vaut 0 |
| Note finale selon un barème validé | Partielle | Calculée, mais pas de barème validé unique ; indicateurs et lignes en désaccord |
| Totaux, seuils | Partielle | Indicateurs présents ; seuil de 70 % écrit en dur |
| Alertes sans altérer les notes | Partielle | « 12,5 » devient « 125 » ; dépassement sans message ; note partielle non signalée ; alertes visibles seulement au survol |

Hors demande, mais à prévoir : les notes ne sont pas contrôlées par le serveur.

Prévu (cadrage du 05/11) :
- **Barème.**
  - La ligne de barème reste au-dessus du tableau, chaque case alignée sur sa colonne.
  - Chaque en-tête rappelle son barème, mis en évidence. Exemple : « Test d'entrée **(/30)** ».
  - Libellé : « Barème (note maximale en point ou en pourcentage) ».
- **Saisie.**
  - En points par défaut, en % au choix, avec un interrupteur sur la même ligne.
  - La note saisie est gardée telle quelle : « 12,5 » reste 12,5.
- **Erreurs.**
  - La case en erreur est entourée de rouge, sans changer de taille.
  - Un seul message à la fois, dans la barre d'alerte existante. Exemple : « Ligne 3, Dupont, Pratique :
    22 dépasse le barème de 20 ». Suivi de « + N autres » s'il y en a d'autres.
  - Un clic sur le message mène à la case. Le message change au fur et à mesure des corrections.
  - Une note invalide n'entre pas dans les calculs.
- **Indicateurs.**
  - Les 4 indicateurs en bas du tableau sont retirés.
  - Le compteur « Notes saisies » en haut de page utilise le barème du compte rendu, comme le reste.
- **Seuil.** Chaque formation a son propre seuil, à la place du seuil de 70 % écrit en dur.
- **Progression.** La formule change une fois validée avec les formateurs (décision 3).

### S — Saisie guidée et appréciations
| Demande | Statut | Constat |
|---|---|---|
| Parcours administration → objectifs → journées → évaluations | Partielle | 4 étapes, mais les évaluations passent avant les objectifs et les journées |
| Jusqu'à 5 jours | Partielle | Nombre de jours sans plafond ; 10 jours en certification |
| 4 à 5 thématiques par jour | Partielle | Saisie libre avec compteur, sans minimum ni maximum |
| 10 formulations par catégorie | Absente | Points forts et axes en saisie libre ; 1 à 5 variantes dans le moteur de rédaction |
| Saisie libre, commentaires personnalisés | Livrée | Textes libres, proposition modifiable |
| Appréciations croisées | Absente | — |

Prévu (réponses du 06/11) :
- **Ordre du parcours.** Administration → objectifs → journées → évaluations : les notes passent en dernier.
- **5 jours au plus par session**, certification comprise. Un même groupe sur plusieurs semaines forme une
  session par semaine, chacune avec son compte rendu. Le 6e jour ne peut pas être ajouté.
- **4 à 5 thématiques par jour.** En dessous ou au-dessus, le compteur passe en orange avec un message ; le
  formateur peut continuer.
- **10 formulations par catégorie** (points forts, axes de progrès…), rédigées par nous puis validées par
  Jennifer Lawrynn. La saisie libre reste possible.
- **Une seule appréciation de la formation** (qualité, accueil), pas d'appréciation croisée. Quand la session
  a plusieurs formateurs, l'un la remplit et les autres peuvent la modifier. Chaque modification est gardée
  dans l'historique du compte rendu (voir R).

### P — Synthèse et rapports
| Demande | Statut | Constat |
|---|---|---|
| Synthèse collective issue des résultats individuels | Partielle | Calculée, mais pas avec le même barème selon l'endroit |
| Rapports individuels | Livrée | Une fiche par stagiaire dans le PowerPoint |
| Commentaires par stagiaire | Livrée | Pré-rédigés, modifiables |
| Appréciation générale | Livrée | Bilan en 4 rubriques et un paragraphe |
| Photos intégrées, repositionnables | Partielle | Photos intégrées et recadrables (5 sur les objectifs, 4 par jour) ; pas de placement libre |
| Aperçu en cours de saisie | Livrée | Rendu réel de chaque page |
| Cohérence des chiffres dans l'aperçu | Livrée | Aperçu et fichier utilisent les mêmes valeurs ; l'écart vient de la page des notes (voir E) |
| Lot de 25 rapports | Absente | Un rapport à la fois ; durée pour 25 stagiaires non mesurée |

### U — Ergonomie et recette
| Demande | Statut | Constat |
|---|---|---|
| Parcours guidé, indicateurs de progression | Partielle | Étapes et compteur de pages ; les alertes n'empêchent pas d'avancer |
| Filtres et listes déroulantes | Absente | — |
| Libellés clairs | Partielle | Statuts nommés différemment d'un écran à l'autre |
| Retrait des éléments obsolètes | Absente | 10 composants inutilisés (~1 250 lignes) et anciennes fonctions de calcul, à retirer après validation |
| Recette sur 2 formations | Absente | À planifier en fin de plan |

## Annexe technique (références de code, `cfao-comptes-rendus/`)

- Liste de démonstration : `web/src/data/mock_sessions_formateur.js` ; compte rendu stocké en JSON :
  `api/comptes_rendus/models.py:14` ; enregistrement sans contrôle : `api/comptes_rendus/views.py:230-243`.
- Code modifiable : `web/src/components/compte-rendu/PhaseSession.jsx:141` et 218-224.
- Droits : `cerbos/policies/resource_policies/compte_rendu.yaml` (formateur, KI, PIC, équipe technique).
- Barème : `web/src/pages/TrainerReportNew.jsx:217-222` (sans barème) contre `web/src/utils/remarquesSession.js:51`
  et `PhaseVerification.jsx:65` (avec).
- Saisie : `PhaseResultats.jsx:97-105` (chiffres seuls, 3 caractères) ; note partielle : `baremeCfao.js:65-67`.
- Seuil 70 : `baremeCfao.js:33`, `compteRendu.js:13`, `api/redaction/lexique.py:22`, `moteur_fiche.py:37`.
- Étapes : `TrainerReportNew.jsx:38-43` ; 10 jours en certification : `utils/diapositives.js:399`.
- Code inutilisé : composants `components/compte-rendu/Cr*`, fonctions de `utils/compteRendu.js`.
- Tests : 81 côté navigateur, 183 côté serveur, 4 suites de droits ; aucun sur les calculs ni sur la saisie des notes.
