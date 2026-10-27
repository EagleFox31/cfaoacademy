# Mettre à jour le module Comptes rendus sur le serveur

Le serveur n'a pas le code source : il télécharge les images depuis Docker Hub
(`antifragile237/cfao-comptes-rendus-*`). Une mise à jour consiste à changer le numéro
de version, puis à relancer le module. Les données (base, fichiers, profils des
formateurs) sont conservées.

## Version à installer

**v0.3.0** (27/10/2026). Ce qui change pour les formateurs : à l'étape de vérification, le
formateur coche ce qu'il veut retrouver dans ses prochains comptes rendus, puis enregistre.

## Étapes

Dans le dossier du module sur le serveur (celui qui contient `docker-compose.prod.yml`) :

1. **Mettre les fichiers à jour** : copier `docker-compose.prod.yml` et les scripts depuis
   `\\192.168.10.155\partage\02_projets\cfao-comptes-rendus` si ce n'est pas déjà le
   dossier utilisé.
2. **Changer la version dans le `.env`** :

   ```
   CR_VERSION=v0.3.0
   ```

   Ne modifier **ni** `SECRET_KEY` **ni** `POSTGRES_PASSWORD` : la base a été créée avec
   ce mot de passe.
3. **Relancer le module** :
   - Windows : `.\deploy.ps1`
   - Linux : `./deploy.sh`

   Le script télécharge les nouvelles images puis redémarre les conteneurs. Les
   migrations de la base s'appliquent toutes seules au démarrage de l'API.

## Vérifier

```
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs --tail 30 api
```

Les trois services (`cerbos`, `api`, `gateway`) doivent être `running` ou `healthy`. Ouvrir
ensuite l'adresse du module (par défaut `http://<IP du serveur>:8090`).

## Revenir à la version précédente

Remettre `CR_VERSION=v0.2.0` dans le `.env`, puis relancer le script.

## Si le téléchargement échoue

Le serveur doit pouvoir joindre Docker Hub. Sinon, demander l'archive des images
(`docker save`) et la charger avec `docker load -i <archive>.tar`, puis lancer :

```
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Le script `deploy` n'est pas utilisable dans ce cas, car il commence par un téléchargement.

## Historique des versions

| Version | Date | Changement |
|---|---|---|
| v0.3.0 | 27/10/2026 | Choix des éléments à retrouver dans les prochains comptes rendus. |
| v0.2.0 | 19/10/2026 | Première version de production sur images Docker Hub. |
