# Checklist étude SI — détail

À cocher dans l’ordre. Ne pas sauter une case « parce que le fichier a l’air propre ».

## A. As-Is

- [ ] Feuille(s) source identifiée(s) ; vues parasites exclues de l’import
- [ ] Grain métier écrit en une phrase (« 1 ligne = … »)
- [ ] Volumes mesurés (lignes data, clés candidates, vides %, doublons)
- [ ] Fonction `norm()` figée ; tous les comptes recalculés avec
- [ ] Glossaire métier ↔ plateforme (stagiaire = apprenant, etc.)
- [ ] Commentaires / notes / cellules hors grille inventoriés
- [ ] Résidus de formule exclus par test « sans données », pas par n° de ligne
- [ ] Liste explicite : états, id stable, rejets, DCP **absents** des colonnes

## B. Urbanisation

- [ ] Chaque entité MCD a un owner (`identity` / `lms` / `operations` / `needs`)
- [ ] Slice referential sans DCP défini pour `cfao-needs` (si pertinent)
- [ ] Distinction Enrollment numérique ≠ participation physique tranchée

## C. MCD / MLD

- [ ] Entités + associations + cardinalités
- [ ] Calendriers distincts séparés
- [ ] Annexes en 0,1 (pas de dénormalisation HT+TTC+total redondante)
- [ ] Base monétaire `ht|ttc|hors_taxe` ; pas de TVA inventée
- [ ] Identité : PK + username slug ; email/matricule pour compte
- [ ] Collision slug → revue (pas `-2` auto)
- [ ] COMMENTAIRE.cible par bande de colonnes + cas orphelin
- [ ] Bloc DCP / rétention / Cerbos par entité sensible
- [ ] Règles Rn numérotées (bloquant vs warning) **avant** le script

## D. Dry-run

- [ ] Script parse ≠ apply
- [ ] `report.json` : erreurs + warnings **complets**
- [ ] Exit ≠ 0 si rejet bloquant
- [ ] Counts alignés MCD ↔ report ↔ source
- [ ] `entities.json` / report nominatif hors git ; referential versionnable
- [ ] Feuille de revue générée pour chaque file humaine

## E. Avant écriture DB

- [ ] Arbitrages revue complétés (décisions tracées)
- [ ] Collecte id stable (email/matricule) pour comptes à ouvrir
- [ ] `--dry-run` des management commands OK
- [ ] UML (use cases / séquences) seulement si on spécifie l’app, pas le fichier
