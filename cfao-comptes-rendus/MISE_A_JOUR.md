# Mettre à jour le module Comptes rendus sur le serveur

Le serveur n'a pas le code source : il télécharge les images depuis Docker Hub
(`antifragile237/cfao-comptes-rendus-*`). Une mise à jour consiste à changer le numéro
de version, puis à relancer le module. Les données (base, fichiers, profils des
formateurs) sont conservées.

Durée : environ 15 min, dont 2 à 5 min d'interruption.

## Version à installer

**v0.4.1** (29/10/2026), depuis la v0.3.0. Ce qui change :

- les graphiques de l'aperçu affichent les vrais chiffres de la session ;
- sur la fiche individuelle, l'anneau de satisfaction et ses étiquettes sont lisibles et
  bien placés ;
- le bouton retour ramène à la liste d'origine, l'écran de chargement est centré ;
- une annonce prévient les utilisateurs avant une mise à jour, puis liste les nouveautés
  selon leur rôle ;
- nouveau : un journal des erreurs, lu par le compte de l'équipe technique (superadmin).
- les messages d'erreur de la page de connexion sont écrits en blanc, lisibles sur le fond rouge (v0.4.1).

## Étapes

Toutes les commandes se lancent dans le dossier du module sur le serveur (celui qui
contient `docker-compose.prod.yml`). Raccourci utilisé ci-dessous :

```sh
dc() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
```

### 1. Prévenir les utilisateurs (5 min avant)

Les pages ouvertes lisent `maintenance.json` toutes les 2 s. Avec l'état `compte`, une
fenêtre demande d'enregistrer le travail en cours.

```sh
ID=maj-$(date +%Y%m%d-%H%M)
echo "{\"id\": \"$ID\", \"etat\": \"compte\"}" | dc exec -T gateway sh -c 'cat > /usr/share/nginx/html/cr/maintenance.json'
```

Depuis la v0.4.2, l'interface est servie sous `/cr/` : le fichier est dans `html/cr/`.
Passerelle encore en v0.4.1 ou avant : `html/maintenance.json`.

Garder la même valeur `ID` jusqu'à l'étape 6.

### 2. Sauvegarder

```sh
mkdir -p sauvegardes
dc exec -T db pg_dump -U comptes_rendus comptes_rendus > sauvegardes/$ID.sql
docker run --rm -v cfao-comptes-rendus_cr-donnees:/d -v "$PWD/sauvegardes:/s" alpine tar czf /s/$ID-donnees.tgz -C /d .
grep '^CR_VERSION=' .env > sauvegardes/$ID.version
```

On ne continue pas si un fichier de sauvegarde est vide.

### 3. Mettre les fichiers à jour

Copier `docker-compose.prod.yml` et les scripts depuis
`\\192.168.10.155\partage\02_projets\cfao-comptes-rendus` si ce n'est pas déjà le dossier
utilisé.

### 4. Compléter le `.env`

```
CR_VERSION=v0.4.1
CR_COMPTE_TECHNIQUE=<identifiant de l'équipe technique>
CR_COMPTE_TECHNIQUE_MDP=<mot de passe fort, généré pour ce serveur>
ORIGINES_AUTORISEES=http://192.168.10.155:8092
```

- Les deux lignes `CR_COMPTE_TECHNIQUE*` sont nécessaires depuis la v0.4.0 : sans elles,
  le compte technique n'est pas créé. Le mot de passe peut être généré par
  `openssl rand -base64 24`. Il n'est lu qu'à la création du compte : un changement fait
  ensuite dans l'application n'est jamais écrasé.
- `ORIGINES_AUTORISEES` est obligatoire depuis la v0.4.0 : l'origine exacte (schéma, hôte,
  port) par laquelle les utilisateurs ouvrent le module, plusieurs valeurs séparées par
  des virgules. Sans elle, toute connexion échoue en 403 « origine non autorisee ».
- Ne modifier **ni** `SECRET_KEY` **ni** `POSTGRES_PASSWORD` : la base a été créée avec
  ce mot de passe.

### 5. Relancer le module

- Windows : `.\deploy.ps1`
- Linux : `./deploy.sh`

Le script télécharge les nouvelles images, puis redémarre les conteneurs. Au démarrage,
l'API applique seule les migrations (dont `0003`, le journal des erreurs), puis crée le
compte technique. L'image Cerbos porte déjà la nouvelle règle du journal.

### 6. Contrôler, puis annoncer la fin

```sh
dc ps                                   # cerbos, api, gateway : running ou healthy
dc logs --tail 30 api                   # « compte technique : … cree » au premier démarrage
dc exec api curl -fsS http://localhost:5175/apercu/sante
# Connexion par l'origine réelle : 400 ou 401 attendu, jamais 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8092/cr-donnees/connexion \
  -H "Origin: http://192.168.10.155:8092" -H "Content-Type: application/json" -d '{}'
```

Dans le navigateur :

- se connecter avec un compte formateur et ouvrir un compte rendu : l'aperçu doit afficher
  ses graphiques ;
- se connecter avec le compte technique et ouvrir le journal des erreurs.

Annoncer ensuite la fin de la mise à jour. Un champ `pour` réserve une ligne à certains
rôles ; une ligne sans `pour` est visible par tous.

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
  {"texte": "L'équipe technique voit tous les comptes rendus.", "pour": ["superadmin"]}
 ]}
EOF
dc exec -T gateway sh -c 'cat > /usr/share/nginx/html/cr/maintenance.json' < /tmp/fin.json
```

La fenêtre « Mise à jour terminée » reste ouverte tant qu'il y a des nouveautés à lire ;
chaque utilisateur clique sur « Compris ». Personne n'a à recharger la page :

- depuis la v0.4.3, à l'état `terminee`, chaque onglet qui a vu le compte à rebours
  enregistre et se recharge seul, une fois, sur la nouvelle version ;
- un onglet resté sur une version précédente (v0.4.2 ou avant, sans ce code) continue de
  fonctionner : ses appels suivent les redirections, et s'il demande un morceau de
  l'ancienne interface (export Excel), la passerelle lui renvoie de quoi se recharger
  sur la nouvelle version.

Le fichier repart à
`{"id": null, "etat": "aucune"}` au prochain redémarrage de la passerelle.

## Revenir à la version précédente

1. Remettre `CR_VERSION=v0.3.0` dans le `.env` (valeur notée dans
   `sauvegardes/$ID.version`), puis relancer le script.
2. La migration `0003` n'ajoute qu'une table : la v0.3.0 l'ignore. Restaurer la base
   seulement si des données ont été abîmées :

   ```sh
   dc exec -T db psql -U comptes_rendus -c "DROP DATABASE comptes_rendus WITH (FORCE)" postgres
   dc exec -T db psql -U comptes_rendus -c "CREATE DATABASE comptes_rendus" postgres
   dc exec -T db psql -U comptes_rendus comptes_rendus < sauvegardes/$ID.sql
   dc restart api
   ```

Les photos et les rapports se restaurent depuis `sauvegardes/$ID-donnees.tgz` si besoin.

## Si le téléchargement échoue

Le serveur doit pouvoir joindre Docker Hub. Sinon, demander l'archive des images
(`docker save`) et la charger avec `docker load -i <archive>.tar`, puis lancer `dc up -d`.
Le script `deploy` n'est pas utilisable dans ce cas, car il commence par un téléchargement.

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v0.4.1 | 29/10/2026 | Messages d'erreur de connexion lisibles (texte blanc) ; `ORIGINES_AUTORISEES` documentée, obligatoire depuis la v0.4.0. |
| v0.4.0 | 29/10/2026 | Graphiques de l'aperçu, anneau de satisfaction, annonce de mise à jour par rôle, journal des erreurs et compte technique (`CR_COMPTE_TECHNIQUE*` à ajouter au `.env`). |
| v0.3.0 | 27/10/2026 | Choix des éléments à retrouver dans les prochains comptes rendus. |
| v0.2.0 | 19/10/2026 | Première version de production sur images Docker Hub. |
