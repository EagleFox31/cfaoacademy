# Publier une nouvelle version de l'image (poste de développement)

Le serveur ne reçoit aucun code source : il télécharge
`antifragile237/cfao-supervision-api` depuis Docker Hub. Une seule image sert l'API, le
job de migration et le collecteur.

## Règles

- Toujours partir de `origin/main`, dans un worktree propre :

  ```sh
  git fetch origin
  git worktree add --detach ../sup-release origin/main
  cd ../sup-release
  ```

- Un tag publié n'est jamais réécrit : toute correction donne un nouveau tag.
- La version a sa section `## [x.y.z]` dans [CHANGELOG.md](CHANGELOG.md) avant la
  construction : c'est elle que l'écran affiche comme nouveautés.
- `docker login` (compte `antifragile237`) avant de pousser.

## 1. Construire

```sh
V=v0.1.0
python scripts/build_image.py cfao-supervision/api antifragile237/cfao-supervision-api $V \
  --changelog cfao-supervision/CHANGELOG.md
```

Le script pose les labels `org.opencontainers.image.version`, `.revision`, `.created`
et `org.cfao.changelog` (section de la version, 4000 caractères au plus).

## 2. Vérifier, puis pousser

```sh
docker run --rm -e SUPERVISION_SECRET_KEY=x -e DJANGO_SETTINGS_MODULE=config.settings.test \
  antifragile237/cfao-supervision-api:$V python manage.py check
docker image inspect antifragile237/cfao-supervision-api:$V \
  --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
docker push antifragile237/cfao-supervision-api:$V
docker manifest inspect antifragile237/cfao-supervision-api:$V > /dev/null && echo ok
```

## 3. Reporter la version

- Dans le dépôt : `SUPERVISION_VERSION` dans `env.prod.example` et la valeur par défaut
  de `docker-compose.prod.yml`.
- Sur le partage `A:\02_projets\cfao-supervision` : les mêmes fichiers.
- Ajouter la ligne de la version à l'historique ci-dessous et dans
  [MISE_A_JOUR.md](MISE_A_JOUR.md).

## Historique

| Version | Date | Source | Contenu |
|---|---|---|---|
| v0.1.0 | — | — | Première version (à publier). |
