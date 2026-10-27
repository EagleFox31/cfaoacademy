# Publier une nouvelle version des images (poste de développement)

Le serveur ne reçoit aucun code source : il télécharge les images
`antifragile237/cfao-comptes-rendus-{api,cerbos,gateway}` depuis Docker Hub.
Livrer une évolution, c'est donc : construire les images, les pousser sur Docker Hub,
puis passer `CR_VERSION` au nouveau tag (voir [MISE_A_JOUR.md](MISE_A_JOUR.md)).

## Règles

- Toujours partir de `origin/main`, dans un worktree propre : jamais depuis un checkout
  qui contient des modifications non commitées.

  ```sh
  git fetch origin
  git worktree add --detach ../cr-release origin/main
  cd ../cr-release/cfao-comptes-rendus
  ```

- Un seul `CR_VERSION` pour les trois images : une image inchangée est simplement
  re-taguée au nouveau numéro.
- Un tag publié n'est jamais réécrit : toute correction donne un nouveau tag.
- `docker login` (compte `antifragile237`) avant de pousser.

## 1. Repérer ce qui a changé

```sh
git diff --stat <commit de la version précédente> origin/main -- cfao-comptes-rendus
```

| Dossier modifié | Image à refaire |
|---|---|
| `web/` ou `gateway/` | `gateway` |
| `api/` | `api` |
| `cerbos/` | `cerbos` |
| autre (scripts, compose, docs) | aucune |

## 2a. Reconstruction complète (cas normal)

Contexte : dossier `cfao-comptes-rendus/`. `V` est le nouveau tag, par exemple `v0.4.0`.

```sh
V=v0.4.0
docker build -t antifragile237/cfao-comptes-rendus-gateway:$V -f gateway/Dockerfile .
docker build -t antifragile237/cfao-comptes-rendus-api:$V api
docker build -t antifragile237/cfao-comptes-rendus-cerbos:$V cerbos
```

Il faut que Docker accède à Docker Hub (images de base `python`, `node`, `nginx`, `cerbos`).

## 2b. Modification d'une image existante (front seul, sans accès réseau pour Docker)

Quand seul `web/` change, on ne refait que la couche du front sur l'image précédente.
Le front est compilé sous Windows avec npm.

```sh
cd web && npm ci && npx vitest run && npm run build && cd ..
mkdir -p ../patch-gateway && rm -rf ../patch-gateway/dist && cp -r web/dist ../patch-gateway/dist
```

`../patch-gateway/Dockerfile` (remplacer `v0.3.0` par la version précédente) :

```dockerfile
FROM antifragile237/cfao-comptes-rendus-gateway:v0.3.0
RUN find /usr/share/nginx/html -mindepth 1 -maxdepth 1 ! -name 50x.html -exec rm -rf {} +
COPY dist/ /usr/share/nginx/html/
```

```sh
docker build --pull=false -t antifragile237/cfao-comptes-rendus-gateway:$V ../patch-gateway
```

Pour l'API, ce raccourci n'est valable que si `requirements.txt` n'a pas changé et qu'aucun
fichier n'a été supprimé : sinon, reconstruction complète.

## 3. Re-taguer les images inchangées

```sh
docker tag antifragile237/cfao-comptes-rendus-api:<précédente>    antifragile237/cfao-comptes-rendus-api:$V
docker tag antifragile237/cfao-comptes-rendus-cerbos:<précédente> antifragile237/cfao-comptes-rendus-cerbos:$V
```

## 4. Vérifier, puis pousser

```sh
# nginx valide sa configuration (l'hôte api est simulé hors compose)
docker run --rm --add-host api:127.0.0.1 antifragile237/cfao-comptes-rendus-gateway:$V nginx -t

for i in gateway api cerbos; do docker push antifragile237/cfao-comptes-rendus-$i:$V; done
for i in gateway api cerbos; do docker manifest inspect antifragile237/cfao-comptes-rendus-$i:$V > /dev/null && echo "$i ok"; done
```

## 5. Reporter la version

- Dans le dépôt : `CR_VERSION` dans `env.prod.example` et la valeur par défaut de
  `docker-compose.prod.yml`, puis commit et push sur `main`.
- Sur le partage `A:\02_projets\cfao-comptes-rendus` (`\\192.168.10.155\partage`) : les
  mêmes fichiers (`env.prod.example` y est copié sous le nom `.env.example`).
- Ajouter la ligne de la version à l'historique de [MISE_A_JOUR.md](MISE_A_JOUR.md).

## Historique

| Version | Date | Source | Contenu |
|---|---|---|---|
| v0.3.0 | 27/10/2026 | `main` 34a9666 | `gateway` refaite par modification de la v0.2.0 (front : choix des éléments à retrouver dans les prochains comptes rendus). `api` et `cerbos` identiques à la v0.2.0. |
| v0.2.0 | 19/10/2026 | `main` | Pile de prod sur images Docker Hub. |
