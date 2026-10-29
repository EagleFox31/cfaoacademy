# Étude : fiche « Résultat individuel » (anneau seul, position de l'objet) et jours ouvrés

## Besoin
Retours du 29/10 sur la copie Tamo :
1. sans note d'accueil, l'anneau « Qualité de la formation » est trop épais, coupé en bas, et
   la bordure droite du tableau a disparu ;
2. l'objet Excel ouvert dans PowerPoint est un peu plus à gauche que l'aperçu de l'application ;
3. du 30/09 au 06/10/2026, le rapport compte 7 jours au lieu de 5.

## État de l'existant et causes
| Point | Code | Cause mesurée |
|---|---|---|
| 1 | `api/rendu/classeurs.py` `_sans_moitie_absente`, `_rogner` | Une seule série garde le trou du modèle (50 %) : l'anneau prend l'épaisseur des deux. LibreOffice rend la feuille à une note ~1,5 % plus grande (tableau 874 px au lieu de 861) ; le rognage sur la boîte absolue de la référence coupait donc la bordure droite et le bas de l'anneau. |
| 2 | `_rogner` (bord transparent) | Le bord ajouté pour les proportions du cadre était centré ; Excel ancre la zone visible en haut à gauche (l'EMF du modèle a son contenu à x = 0). |
| 3 | `web/src/utils/compteRendu.js` `nombreDeJours` / `joursDeSession` | Différence de dates brute, week-ends compris. |

## Options
| Option | Pour | Contre |
|---|---|---|
| 1a. Trou agrandi dans le classeur embarqué (`holeSize`) + rendu ramené à la largeur de la référence | Corrige aussi l'objet ouvert dans PowerPoint ; le tableau garde sa place | Image rééchantillonnée (~1,5 %) |
| 1b. Corriger seulement l'image | Simple | L'objet Excel reste épais |
| 2a. Ancrer l'aperçu en haut à gauche | Même place que l'objet Excel | La zone vide passe à droite |
| 2b. Redimensionner le cadre de l'objet dans la diapositive | Centré partout | Modifie la mise en page du modèle |
| 3a. Jours ouvrés (lundi–vendredi) ; un nombre de jours fourni par le planning reste prioritaire | Conforme à la demande | Jours fériés non exclus |

## Choix
1a, 2a, 3a. `VERSION_IMAGES` passe à 11 (images en cache régénérées).

## Impacts et risques
Aucune donnée ni migration. Les brouillons dont `nbJours` est déjà enregistré gardent leur
valeur. Jours fériés : non traités (à trancher si besoin). Le point 2 se vérifie dans
PowerPoint par l'utilisateur.
