# Mettre à jour le module des comptes rendus en production (Docker)

Procédure pas à pas pour la pile `cfao-comptes-rendus/` (passerelle, API, base, Cerbos).
Toutes les commandes se lancent depuis `cfao-comptes-rendus/`.

Durée : environ 15 min, dont 2 à 5 min d'interruption.

## 1. Prévenir les utilisateurs (5 min avant)

Les pages ouvertes lisent `maintenance.json` toutes les 2 s. Avec l'état `compte`, une
fenêtre s'ouvre et demande d'enregistrer le travail en cours.

```sh
ID=maj-$(date +%Y%m%d-%H%M)
echo "{\"id\": \"$ID\", \"etat\": \"compte\"}" | docker compose exec -T gateway sh -c 'cat > /usr/share/nginx/html/maintenance.json'
```

Il faut garder la même valeur `ID` jusqu'à l'étape 6.

## 2. Sauvegarder

```sh
mkdir -p sauvegardes
docker compose exec -T db pg_dump -U comptes_rendus comptes_rendus > sauvegardes/$ID.sql
docker run --rm -v cfao-comptes-rendus_cr-donnees:/d -v "$PWD/sauvegardes:/s" alpine tar czf /s/$ID-donnees.tgz -C /d .
git rev-parse HEAD > sauvegardes/$ID.version
```

On ne continue pas si un fichier de sauvegarde est vide.

## 3. Récupérer le code

```sh
git fetch origin
git checkout feature/04-5-rapports-formateur
git pull --ff-only
```

## 4. Vérifier le fichier `.env`

Ajouter ces lignes si elles sont absentes. Le compte technique donne accès au journal
des erreurs.

```
CR_COMPTE_TECHNIQUE=<identifiant de l'équipe technique>
CR_COMPTE_TECHNIQUE_MDP=<mot de passe fort>
```

## 5. Reconstruire et relancer

```sh
docker compose build --no-cache api gateway
docker compose up -d
docker compose restart cerbos
```

- `--no-cache` est obligatoire pour l'API : l'image doit installer LibreOffice Calc et les
  polices (mscorefonts, `polices.conf`). Sans eux, les graphiques de l'aperçu sont faux.
- Le redémarrage de Cerbos charge la nouvelle règle du journal des erreurs.
- Au démarrage, l'API applique seule les migrations (dont `0003`, le journal), puis crée le
  compte technique.
- La mémoire de l'API reste à 1 Go au moins (`mem_limit: 1g`) : la conversion en images
  en a besoin.

## 6. Contrôler, puis annoncer la fin

```sh
docker compose ps                     # tous les services « healthy »
docker compose exec api curl -fsS http://localhost:5175/apercu/sante
```

Ensuite, à faire dans le navigateur :

- se connecter avec un compte formateur et ouvrir un compte rendu : l'aperçu doit afficher
  ses graphiques ;
- se connecter avec le compte technique et ouvrir le journal des erreurs.

Puis annoncer la fin de la mise à jour. Un champ `pour` réserve une ligne à certains rôles.
Une ligne sans `pour` est visible par tous.

```sh
cat > /tmp/fin.json <<EOF
{"id": "$ID", "etat": "terminee", "message": "Vous pouvez reprendre votre travail.",
 "changements": [
  {"texte": "Les graphiques de l'aperçu affichent les vrais chiffres de la session."},
  {"texte": "Sur la fiche individuelle, l'anneau de satisfaction et ses étiquettes sont lisibles et bien placés."},
  {"texte": "Les titres des diapositives sont mieux espacés."},
  {"texte": "Le bouton retour ramène à la liste d'où vous venez ; l'heure d'enregistrement ne le recouvre plus."},
  {"texte": "L'indicateur de chargement est centré à l'écran."},
  {"texte": "Nouveau : journal des erreurs du service, avec suppression.", "pour": ["superadmin"]},
  {"texte": "Compte technique créé automatiquement au démarrage.", "pour": ["superadmin"]},
  {"texte": "L'équipe technique voit tous les comptes rendus.", "pour": ["superadmin"]}
 ]}
EOF
docker compose exec -T gateway sh -c 'cat > /usr/share/nginx/html/maintenance.json' < /tmp/fin.json
```

La fenêtre « Mise à jour terminée » reste ouverte tant qu'il y a des nouveautés à lire.
Chaque utilisateur clique sur « Compris ».

Le fichier repart à `{"id": null, "etat": "aucune"}` à la prochaine reconstruction de la
passerelle. On peut aussi le remettre à zéro à la main le lendemain.

## 7. Revenir en arrière (en cas de problème)

```sh
git checkout $(cat sauvegardes/$ID.version)
docker compose build api gateway && docker compose up -d
docker compose exec -T db psql -U comptes_rendus -c "DROP DATABASE comptes_rendus WITH (FORCE)" postgres
docker compose exec -T db psql -U comptes_rendus -c "CREATE DATABASE comptes_rendus" postgres
docker compose exec -T db psql -U comptes_rendus comptes_rendus < sauvegardes/$ID.sql
docker compose restart api
```

Les photos et les rapports se restaurent depuis `sauvegardes/$ID-donnees.tgz` si besoin.

## Installation sans Docker (Windows)

La procédure suit les mêmes étapes :

- copier `db.sqlite3` ;
- passer au nouveau commit ;
- `python manage.py migrate` puis `python manage.py compte_technique` ;
- relancer Django et Cerbos ;
- reconstruire le front ;
- écrire `maintenance.json` dans `public/` du portail **et** du module (`cfao-comptes-rendus/web/public/`).
