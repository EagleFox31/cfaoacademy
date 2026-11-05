# Étude : photo individuelle facultative du stagiaire (04-5, 3d)

## Besoin
Sur la fiche individuelle d'un rapport de formation (diapositive 27, « Appréciation du formateur »),
pouvoir poser une photo carrée du stagiaire. Facultative : sans photo, le rendu reste celui d'aujourd'hui.
- Rapport (PPTX et PDF) : la zone d'appréciation se rétrécit, la photo 1:1 se place à sa droite, à la
  hauteur du cadre.
- Écran de relecture (fiche du stagiaire) : même disposition ; ajout, recadrage 1:1, retrait.

## Existant
| Brique | Rôle | Réutilisation |
|---|---|---|
| `photosService.useRefsPhotos` / `ancrerPhotos` | envoi unique au service, identifiant serveur gardé dans le brouillon | ajouter les photos des stagiaires à la liste envoyée et ancrée |
| `ImageCadree`, `BoutonRecadrer` | image remplissant sa case, cadrage `{x, y}` en % | tels quels |
| `diapositives.photosDesDiapos` | `@photos` par numéro de diapositive | une entrée pour la diapo 27 de la fiche courante |
| `service.poser_photos` → `photos.poser_nommes` | pose une photo à la place d'une forme nommée, rognée par `rognage` | nouveau cas : poser **à côté** de la forme nommée |
| Modèle, diapo 27, `ZoneTexte 9` | x 170688, y 4944618, 7827264 × 1707642 EMU, `spAutoFit` | forme rétrécie de `h + écart` ; photo `h × h` à droite |

Les fiches de certification (diapo 26) ne sont pas concernées : la demande vise la fiche de formation.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. Emplacement photo ajouté au modèle PPTX | rendu figé dans le modèle | une forme vide à effacer sans photo ; modèle à retoucher et à garder aligné |
| B. Le service rétrécit la zone et pose l'image (`cote: 'droite'` sur `poser_nommes`) | aucun changement du modèle ; sans photo rien ne bouge ; réutilise `rognage`, `forme_image`, `_joindre` | géométrie calculée en code |

**Choix : B.** La photo est stockée dans le participant (`participants[i].photo = {id, nom, apercu, ref, cadrage}`),
comme le portrait d'un formateur.

## Impacts
- Données : champ facultatif dans le brouillon, aucune migration ; les brouillons existants n'ont pas de photo.
- Sécurité : mêmes routes et cloisonnement que les autres photos (`/apercu/photo`, `/cr-donnees/photos`).
- Mise en page : l'appréciation perd ~1,8 cm de largeur (≈ 22 %) ; la zone s'agrandit déjà avec son texte
  (`spAutoFit`), un texte long descend un peu plus bas.
- Déploiement : front + service, sans changement de modèle.

## Risques
- Photo très large : rognée au centre par défaut, recadrable comme les autres.
- Liste des stagiaires réimportée à l'étape 1 : une photo n'est gardée que si le participant l'est.
