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
| P1 Évaluations et progression | Non démarré | 50 % | 13/11 | Décision 3 (barème) | Audit, annexe E |
| P2 Saisie guidée et appréciations | Non démarré | 40 % | 27/11 | Décisions 4, 7, 8 | Audit, annexe S |
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
- **Session = code + dates.** Un même code peut couvrir plusieurs sessions (groupes différents) ; un même
  groupe sur plusieurs semaines forme une seule session.
- Stagiaire identifié par nom, prénom et pays (pas de matricule) ; un absent est marqué, jamais retiré.
- Un **% de complétion** est calculé et affiché sur chaque compte rendu.
- Les comptes rendus existants sont repris dans la nouvelle base, après un essai à blanc et un rapport.

Décisions encore attendues :

1. ~~Source unique des formations et des participants~~ : tranchée (import du fichier).
2. ~~Profils habilités~~ : tranchée (un administrateur ; trois lecteurs, tous périmètres).
3. Barème et formules définitifs : notes sur 30/30/20 ? Seuil de 70 % ? Progression en points, en % ou les deux ?
   Note finale quand une épreuve manque ?
4. Appréciations croisées : qui apprécie qui (formateur ↔ stagiaire, stagiaires entre eux) ?
5. Lot de 25 rapports : un seul fichier ou 25 fichiers ?
6. Photos repositionnables : recadrage dans la case (existe) ou placement libre sur la page ?
7. Ordre du parcours : administration → objectifs → journées → évaluations, à la place de l'ordre actuel
   (formation → notes → pages) ?
8. Plafond de 5 jours : les certifications sur 10 jours sont-elles exclues ?
   Le fichier compte déjà une formation sur 3 semaines (même groupe).
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

### S — Saisie guidée et appréciations
| Demande | Statut | Constat |
|---|---|---|
| Parcours administration → objectifs → journées → évaluations | Partielle | 4 étapes, mais les évaluations passent avant les objectifs et les journées |
| Jusqu'à 5 jours | Partielle | Nombre de jours sans plafond ; 10 jours en certification |
| 4 à 5 thématiques par jour | Partielle | Saisie libre avec compteur, sans minimum ni maximum |
| 10 formulations par catégorie | Absente | Points forts et axes en saisie libre ; 1 à 5 variantes dans le moteur de rédaction |
| Saisie libre, commentaires personnalisés | Livrée | Textes libres, proposition modifiable |
| Appréciations croisées | Absente | — |

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
