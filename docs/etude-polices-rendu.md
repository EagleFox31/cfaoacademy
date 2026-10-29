# Étude — polices du rendu des comptes rendus (Docker / Windows)

## Besoin
Le PowerPoint rendu par le service (`cfao-comptes-rendus`) doit avoir la même mise en page
sous Docker (Linux) que sous Windows et que le modèle de référence.

## Inventaire du modèle
`cfao-comptes-rendus/api/rendu/modeles/MODELE-REFERENCES.pptx` — aucune police embarquée.

| Police | Occurrences | Licence | Windows (poste) | Docker (image) |
|---|---|---|---|---|
| Gotham Black | 2904 | commerciale (Hoefler) | absente | absente |
| Arial | 441 | Microsoft | présente | absente |
| Arial Nova (+ Light) | 334 | Microsoft (téléchargeable Windows) | absente | absente |
| Brandon Grotesque Medium | 28 | commerciale (HVD) | absente | absente |
| Calibri | 4 | Microsoft | présente | absente |
| Wingdings | 3 | Microsoft | présente | absente |
| Algerian | 1 | Microsoft (Office) | présente | absente |

Aucune des deux machines n'a les vraies polices du titre (Gotham) ni du texte (Arial Nova).

## Substitutions observées (PDF produits, polices intégrées)
| Police du modèle | LibreOffice Windows | Docker (58cc532) |
|---|---|---|
| Gotham Black | Arial Black | Liberation Sans Bold |
| Arial Nova | Calibri | Liberation Sans |
| Arial Nova Light | Calibri Light | Liberation Sans |
| Calibri | Calibri | Carlito (métrique identique) |

## Écarts constatés (diapo résultats, fiche individuelle)
- Titres moins gras sous Docker (Liberation Sans Bold contre Arial Black).
- Texte plus large sous Docker : Liberation Sans (métrique Arial) est nettement plus large
  que Calibri ; le titre de la page 7 passe sur 3 lignes et chevauche le tableau, « CFAO ACADEMY »
  est tronqué en couverture, les commentaires des fiches occupent plus de lignes.
- Tableaux et graphiques à 0 % : identiques des deux côtés → données ou graphique non
  rafraîchi, pas une question de police.

## Approche Precis (projet de référence)
Polices libres versionnées dans le dépôt (`backend/fonts/`), contrôle bloquant au build
(`scripts/verifier_polices.py` : échec si une police attendue manque), paquets apt
liberation / carlito / caladea / dejavu, catalogue Google Fonts préchargé non bloquant.
Transposable tel quel ; seules les polices libres peuvent être versionnées.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Calquer Windows : `ttf-mscorefonts-installer` (Arial, Arial Black), fontconfig Gotham Black → Arial Black, Arial Nova → Carlito | Rendu Docker = rendu Windows actuel ; gratuit ; légal (EULA acceptée à l'installation) | Reste une substitution ; Carlito sans graisse Light ; dépôt `contrib` |
| B. Équivalents libres versionnés (Montserrat Black pour Gotham, Carlito/Inter pour Arial Nova) + contrôle Precis | Reproductible, sans licence | Rendu différent de Windows et du modèle |
| C. Vraies polices sous licence copiées dans l'image + contrôle bloquant | Fidèle au modèle | Licence serveur/embarquement Gotham et Brandon à acheter ; Arial Nova non redistribuable sur Linux |

## Recommandation
Option A tout de suite (aligne Docker sur Windows, sans coût), avec le contrôle bloquant de
Precis (`fc-match` attendu pour chaque police du modèle). Option C seulement si l'identité
exacte du modèle est exigée : **décision et achat de licences à l'utilisateur**.

## Mise en œuvre (a080bfd)
Option A retenue : `ttf-mscorefonts-installer` (dépôt contrib), Carlito, alias fontconfig
(`cfao-comptes-rendus/polices.conf`) et contrôle `fc-match` bloquant au build.
Graphiques à 0 % dans l'aperçu Docker : l'image n'avait pas **LibreOffice Calc**, donc les
classeurs embarqués n'étaient pas recalculés (image du modèle conservée). `libreoffice-calc`
ajouté ; vérifié sur les diapos 17 et 27 (valeurs réelles). Non couvert sous Linux :
Wingdings, Algerian (absents du rendu des comptes rendus testés).
