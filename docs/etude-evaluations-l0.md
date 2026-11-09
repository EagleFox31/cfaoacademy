# Étude — corrections des évaluations (lot L0, 9–10/11/2026)

## Besoin
Les notes saisies dans la phase « Résultats » faussent les comptes rendus. Il faut corriger ce qui altère
les données avant toute nouvelle fonction (plan du 2/12, lot L0).

## État de l'existant (`cfao-comptes-rendus/`)
| Point | Constat | Où |
|---|---|---|
| Virgule décimale | `modifier()` supprime tout sauf les chiffres : « 12,5 » devient « 125 ». L'input est `type="number"`. | `web/src/components/compte-rendu/PhaseResultats.jsx:97-105`, `:455` |
| Barème modifié | La synthèse du haut de page appelle `syntheseGroupe(participants)` sans `brouillon.baremes`, donc avec les barèmes par défaut. | `web/src/pages/TrainerReportNew.jsx:220` |
| Hors barème | `anomalies()` signale déjà « maximum X », mais `enPourcentage()` calcule quand même (32/30 = 106,7 %). | `web/src/utils/baremeCfao.js:40-45`, `:118-146` |
| En-têtes | Le tableau de saisie affiche déjà « sur X ». À contrôler : certification, `CrNotes`, exports Excel. | `PhaseResultats.jsx:422-424` |
| Seuil 70 | Écrit en dur partout. JS : `baremeCfao.SEUIL`, `compteRendu.SEUIL_DEFAUT` (déjà lu via `session?.seuil` dans `CrFiches`, `CrNotes`, `CrRecapitulatif`), `certification.js`, `classeurCertification.js`, `diapositives.js`, `SaisieCertification.jsx`. Python : `lexique.py:22`, `lexique_session.py:23`, `moteur.py`, `moteur_fiche.py:37`, `moteur_certification.py:19` ; seul `moteur_session.py:143` lit déjà `seuil` dans la requête. | — |

## Options pour le seuil
| Option | Pour | Contre |
|---|---|---|
| A. Réglage du compte rendu (`brouillon.seuil`, défaut 70), transmis à tout le reste | Utile tout de suite, et L1 n'aura qu'à préremplir depuis la formation | Paramètre à faire passer partout |
| B. Constante unique centralisée, sans réglage | Petit diff | Ne répond pas au besoin, tout est à refaire en L1 |
| C. Attendre le référentiel (L1) | Rien à faire maintenant | Le 70 en dur reste jusqu'au 13/11 |

**Choix : A.** Une seule source par langage (`SEUIL_DEFAUT` en JS dans `baremeCfao.js`, en Python dans
`redaction/regles.py`). Chaque calcul reçoit `seuil` en paramètre, avec 70 par défaut. Le champ « Validé à __ % »
se place à côté de « Notés sur ». La valeur passe dans l'objet session construit depuis le brouillon et dans
les requêtes de rédaction (`participantPourMoteur` et les appels de session, de fiche et de certification).

## Saisie décimale
- L'input passe en `type="text" inputMode="decimal"`. La saisie se limite aux chiffres et à un séparateur
  (`,` ou `.`), avec une décimale.
- Le texte saisi est conservé, virgule comprise. La lecture passe par `lireNote()` (virgule → point), utilisée
  par `enPourcentage`, `anomalies` et les exports.
- Même traitement pour les notes de modules en certification (`SaisieCertification.jsx`).

## Note invalide
Si la valeur est non numérique, négative ou au-dessus du barème, `enPourcentage` renvoie `null`. La note est
alors exclue de la progression, du score et des moyennes. L'erreur reste affichée sur la cellule (classe
d'erreur et message), et le compte des notes manquantes l'inclut.

## Impacts
- Données : les brouillons existants restent valides (chaînes de chiffres) et l'absence de `seuil` vaut 70.
  Aucune migration, aucune réécriture des textes existants.
- Risque : les anciennes notes « 125 » issues du bug restent en base. Elles apparaîtront désormais en erreur
  (> barème), ce qui est le comportement voulu, sans correction automatique.
- Tests : `baremeCfao` (virgule, hors barème exclu, seuil), synthèse avec barème modifié, Python seuil transmis.

## Points tranchés
Une décimale au plus. Le seuil se règle par compte rendu, entre 1 et 100. Le rattachement à la formation est
prévu en L1.
