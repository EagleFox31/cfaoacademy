# Coordination entre sessions de travail

Plusieurs sessions travaillent en même temps sur ce dépôt. Cette règle évite qu'une session casse le travail d'une autre ou reconstruise ce qui n'a pas changé. Outil : `python scripts/coord.py` (état partagé dans `.git/cfao-coordination/`, jamais commité).

## 1. Avant de commencer
- `python scripts/coord.py board` : qui fait quoi. Une zone appartient à une session : on n'édite pas un fichier d'une zone voisine sans l'annoncer.
- Chercher l'existant avant de créer un module (RAIDER, AGENTS.md §6) : un nouveau module doit justifier pourquoi un existant ne convient pas.
- Un plan court (objectif, fichiers touchés, preuves prévues) est écrit dans la passation de la session avant tout travail de plus d'une retouche.

## 2. Preuves obligatoires avant « terminé »
- Changement d'écran : test UI réel (Playwright) sur la recette, et dire ce qui a été vu.
- Changement d'API ou de règle : test unitaire ou d'API qui échoue sans le changement ; `cerbos compile --tests` si une règle d'accès bouge.
- Pas de « c'est fait » sans sortie de test ou capture.

## 3. Builds : un à la fois, seulement ce qui a changé
1. `python scripts/coord.py impact` : liste les images touchées. On ne reconstruit que celles-là.
2. `python scripts/coord.py lock build:<image> --who <session> --why <motif>`. Si c'est occupé, on attend : pas de build en parallèle sur la même image.
3. Build (`scripts/build_image.py ... --who <session>` pour une image versionnée), puis `unlock`. Le script refuse de construire sans ce verrou (ou si une autre session le tient) ; `--dry-run` n'en a pas besoin.
   Livraison groupée : `coord.py release add / ready / freeze / done` (file de livraison, une construction par image et par lot, preuve obligatoire, rien de non commité).
4. Conteneur du front, redémarrage de la recette et déploiement serveur : mêmes verrous (`front-container`, `recette-restart`, `deploy:serveur`) et message aux autres sessions avant et après.
5. Un verrou expire seul après 30 minutes : une session tombée ne bloque personne.

## 4. Commits
- Un commit par sujet terminé et testé, au moins un par jour de travail. `python scripts/coord.py daily` montre ce qui reste non commité par zone.
- Messages : uniquement le changement technique.
