# Registre des contrats inter-modules

Chaque module a son image et se déploie seul. Toute communication entre
modules (HTTP, puis webhooks) passe par un contrat déclaré ici, pour qu'une
nouvelle image ne casse pas en silence un module déjà en service.

## Ce que contient le registre

`registry.json` est la seule source. Il déclare :
- `label_namespace` : préfixe des labels d'image (`org.cfao`) ;
- `modules` : le Dockerfile de chaque module et les dépôts de ses images
  publiées (pour reconnaître les images antérieures au registre) ;
- `contracts` : pour chaque contrat, son fournisseur, son format (`openapi`,
  `asyncapi`, `jsonschema`), sa spec publiée (dans le module fournisseur) et
  ses consommateurs avec la plage acceptée (`^1`, `^1.2`), les fichiers client
  et le test consommateur.

| Contrat | Fournisseur | Consommateurs |
|---|---|---|
| `mail-outbound` 0.1.0 | cfao-academy-mail | aucun pour l'instant |
| `needs-analytics` 1.0.0 | cfao-needs | cfao-core `^1` |

Les scripts ne contiennent aucun nom de projet, de branche ou de module : tout
vient du registre.

## Les contrôles

1. **Fournisseur** (pytest du module) : la spec publiée est celle que génère le
   code, et les vraies réponses du serveur la respectent.
2. **Consommateur** (pytest du module) : chaque appel HTTP est confronté à la
   spec du fournisseur (route, paramètres, en-tête de sécurité), et l'exemple
   de la spec sert de réponse. Un champ renommé fait échouer le test.
3. **Labels** (`sync.py`) : les labels `org.cfao.*` des Dockerfiles sont
   générés depuis le registre dans un bloc délimité `# contracts:begin/end`,
   placé après le dernier `FROM`. Le script n'écrit que ce bloc et seulement
   s'il dérive : un second passage n'écrit rien. Un label de l'espace de noms
   trouvé hors du bloc est un conflit signalé, jamais modifié.
4. **Évolution** (`check.py`, job CI `contracts`) : spec modifiée = version
   haussée ; rupture détectée par l'outil du format (oasdiff pour OpenAPI) =
   MAJOR haussée. La base de comparaison est découverte (`GITHUB_BASE_REF`,
   sinon `origin/HEAD`) ; introuvable, l'étape est sautée avec un avertissement.
5. **Déploiement** (`can_i_deploy.py`) : avant `docker compose pull`, compare
   les labels de l'image candidate à ceux des conteneurs en service.

## Commandes

```bash
python contracts/sync.py                 # réconcilie les labels (no-op si convergés)
python contracts/sync.py --check         # code 1 si dérive ou conflit
python contracts/check.py                # base auto ; --base REF|none ; oasdiff facultatif en local
pytest -q contracts/tests
python contracts/can_i_deploy.py antifragile237/cfao-needs-api:v0.2.0 --ssh cfao-serveur
```

`can_i_deploy.py` ne fait que lire (`docker image inspect` en local,
`docker inspect` sur le serveur). Un conteneur est rattaché à son module par son
label, sinon par le dépôt de son image déclaré dans `modules[*].images`. Un
module rattaché mais sans labels (image publiée avant le registre) a une
version inconnue ; les conteneurs étrangers au registre (bases, passerelles)
sont ignorés.

| Code | Verdict |
|---|---|
| 0 | déployable |
| 1 | incompatible (version refusée, fournisseur absent) |
| 2 | compatibilité inconnue (contrepartie sans labels) |

`--allow-missing` tolère un fournisseur absent.

## Ajouter ou faire évoluer un contrat

1. Le fournisseur génère sa spec depuis son code (modèle :
   `cfao-needs/api/analytics/contract.py`, `python -m analytics.contract`,
   qui n'écrit que si la spec change) et la sert sur `GET .../contract`.
2. Déclarer le contrat et ses consommateurs dans `registry.json`, puis lancer
   `python contracts/sync.py` et ajouter les chemins au filtre `contracts` de
   `.github/workflows/ci.yml` (testé).
3. Changement compatible : MINOR ou PATCH. Rupture : pas de rupture en place ;
   ajouter la v2 à côté, migrer les consommateurs, puis retirer en MAJOR.
