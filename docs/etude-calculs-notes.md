# Étude : fiabilité des calculs et de la saisie des notes (lot 2)

## Besoin
Les chiffres du compte rendu doivent être justes et lisibles : même barème partout, notes en points et en
pourcentage, note finale partielle signalée, saisie des demi-points sans dépasser le barème. L'objet de
satisfaction de la fiche individuelle ne doit pas changer de taille quand on l'ouvre dans PowerPoint.

## Existant
- `web/src/utils/baremeCfao.js` : `calculer` (30/30/20, progression relative, note finale = moyenne des
  sorties, ou la seule sortie connue) et `syntheseGroupe`. Aucun test direct.
- `pages/TrainerReportNew.jsx:220` appelle `syntheseGroupe(participants)` sans `brouillon.baremes` : avec un
  barème modifié (ex. pratique sur 40), la synthèse de l'en-tête diffère de celle de l'étape 2.
- `PhaseResultats.jsx` : `modifier` ne garde que les chiffres (12,5 devient 125), coupe à 3 caractères, ne
  plafonne pas ; l'erreur « maximum 30 » s'affiche mais la valeur reste.
- Une note finale calculée sur une seule épreuve de sortie s'affiche comme une note complète.
- `api/rendu/classeurs.py` `remplir_classeur` : les lignes des classeurs incorporés ont `ht` sans
  `customHeight="1"` ; Excel les réajuste à l'ouverture, l'objet change de taille.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Corriger dans le navigateur (utils + écran de saisie) | Court, testable (vitest), aucune migration | Pas de contrôle serveur (prévu au lot 4) |
| B. Recalcul serveur dès maintenant | Source unique | Dépend du référentiel (lot 3), hors délai |

**Choix : A.** Le contrôle serveur reste au lot 4.

## Décisions prises
- Saisie : virgule ou point acceptés, une décimale au plus, valeur au-dessus du barème ramenée au barème.
  Champ texte à clavier décimal (`type="number"` rejette la virgule selon le navigateur).
- Points + % : le pourcentage s'affiche sous chaque note saisie.
- Note partielle : `calculer` renvoie `partielle` ; repère « partielle » dans le tableau, compteur dans la
  synthèse. Non bloquant : certaines formations n'ont pas de pratique.
- `customHeight="1"` ajouté à toute ligne qui porte une hauteur, dans tous les classeurs remplis : la
  hauteur du modèle est celle que mesure déjà `_hauteur_zone`.

## Impacts / risques
Aucune donnée migrée : les brouillons existants gardent leurs chaînes (« 125 » saisi par erreur reste à
corriger à la main, l'anomalie « maximum » le signale). Rendu : hauteurs figées, identiques au modèle.

## À trancher (Jennifer, mail du 05/11, point 3)
Barème et formules définitifs ; règle de la note finale sans pratique.
