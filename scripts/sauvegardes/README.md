# Sauvegardes planifiées du serveur

- `sauvegarde.sh` : sauvegarde les bases needs, planning, core et identité (pg_dump au format custom) et le dossier des comptes rendus (copie à chaud des SQLite, puis archive sans `cache/`). Chaque passe crée un lot daté avec ses empreintes `SHA256SUMS`, plus un marqueur `COMPLET` si tout a réussi. Les lots de plus de 14 jours sont supprimés, sauf le dernier lot complet.
- `restauration-test.sh` : restaure le dernier lot complet dans un Postgres jetable (sans réseau, en mémoire, supprimé à la fin) et vérifie l'intégrité des SQLite. Les conteneurs en service ne sont jamais touchés.
- Les deux scripts sortent en code 1 au moindre échec. Le journal indique lequel.

## Installation sur le serveur (go de manitou requis)
```sh
ssh cfao-serveur 'mkdir -p ~/bin ~/backups'
scp scripts/sauvegardes/sauvegarde.sh cfao-serveur:bin/cfao-sauvegarde.sh
scp scripts/sauvegardes/restauration-test.sh cfao-serveur:bin/cfao-restauration-test.sh
ssh cfao-serveur 'chmod 700 ~/bin/cfao-*.sh && ~/bin/cfao-sauvegarde.sh && ~/bin/cfao-restauration-test.sh'
```
Crontab de `academy` (`crontab -e`) :
```
15 2 * * * $HOME/bin/cfao-sauvegarde.sh >> $HOME/backups/sauvegarde.log 2>&1
45 2 * * 0 $HOME/bin/cfao-restauration-test.sh >> $HOME/backups/restauration.log 2>&1
```
Retour arrière : supprimer les deux lignes de la crontab. Les scripts n'écrivent que dans `~/backups`.

## Copie hors serveur
Le partage A: est servi par ce même serveur : y copier les lots ne protège pas contre la perte du serveur. `SAUVEGARDE_COPIE=hote:/chemin` envoie chaque lot par scp vers une autre machine. Destination à choisir avec l'utilisateur. Sur Azure, ce rôle revient aux sauvegardes managées de PostgreSQL Flexible et d'Azure Files.

## Tester en local
Les variables `SAUVEGARDE_DIR`, `SAUVEGARDE_BASES` (`conteneur:utilisateur:base ...`), `SAUVEGARDE_CR_DIR` et `PYTHON` permettent de viser les conteneurs de la recette (testé le 19/11 : 4 bases et les comptes rendus restaurés, échecs détectés pour un conteneur absent et un dump tronqué, rotation vérifiée).
