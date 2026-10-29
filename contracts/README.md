# Registre des contrats inter-modules

Chaque module a son image et se déploie seul. Toute communication entre
modules (HTTP, puis webhooks) passe par un contrat déclaré ici, pour qu'une
nouvelle image ne casse pas en silence un module déjà en service.

## Ce que contient le registre

`registry.json` déclare :
- `modules` : le Dockerfile de chaque module concerné ;
- `contracts` : pour chaque contrat, son fournisseur, sa spec OpenAPI publiée
  (dans le module fournisseur, seule source) et ses consommateurs avec la plage
  acceptée (`^1`, `^1.2`), les fichiers client et le test consommateur.

| Contrat | Fournisseur | Consommateurs |
|---|---|---|
| `mail-outbound` 0.1.0 | cfao-academy-mail | aucun pour l'instant |
| `needs-analytics` 1.0.0 | cfao-needs | cfao-core `^1` |

## Les quatre contrôles

1. **Fournisseur** (pytest du module) : la spec publiée est celle que génère le
   code, et les vraies réponses du serveur la respectent.
2. **Consommateur** (pytest du module) : chaque appel HTTP est confronté à la
   spec du fournisseur (route, paramètres, en-tête de sécurité), et l'exemple
   de la spec sert de réponse. Un champ renommé fait échouer le test.
3. **Évolution** (`check.py`, job CI `contracts`) : spec modifiée = version
   haussée ; rupture détectée par oasdiff = MAJOR haussée ; plages des
   consommateurs et labels des Dockerfiles cohérents avec le registre.
4. **Déploiement** (`can_i_deploy.py`) : avant `docker compose pull`, compare
   les labels de l'image candidate à ceux des conteneurs en service.

## Commandes

```bash
python contracts/check.py --base origin/main          # oasdiff facultatif en local
pytest -q contracts/tests
python contracts/can_i_deploy.py antifragile237/cfao-needs-api:v0.2.0 --ssh cfao-serveur
```

`can_i_deploy.py` ne fait que lire (`docker image inspect` en local,
`docker inspect` sur le serveur). Code 0 : déployable. Une image CFAO sans
labels est signalée « non vérifiée » ; `--allow-missing` tolère un fournisseur
absent.

## Ajouter ou faire évoluer un contrat

1. Le fournisseur génère sa spec depuis son code (modèle :
   `cfao-needs/api/analytics/contract.py`, `python -m analytics.contract`) et
   la sert sur `GET .../contract`.
2. Déclarer le contrat et ses consommateurs dans `registry.json`, ajouter les
   labels `org.cfao.*` aux Dockerfiles (`check.py` indique la valeur attendue)
   et les chemins au filtre `contracts` de `.github/workflows/ci.yml` (testé).
3. Changement compatible : MINOR ou PATCH. Rupture : pas de rupture en place ;
   ajouter la v2 à côté, migrer les consommateurs, puis retirer en MAJOR.
