# cfao-needs : points à corriger (durcissement)

Liste pour la session qui reprend ce module. Contexte complet : [PLAN-durcissement.md](../PLAN-durcissement.md) et [PLAN-secrets.md](../PLAN-secrets.md). Un constat = un commit, avec sa preuve. Aucune valeur de secret dans le dépôt, ni dans un message.

| # | Problème | Où | Correctif attendu | Preuve |
|---|---|---|---|---|
| 1 | La prod tourne avec `config.settings.dev` : pas de `prod.py` | docker-compose.prod.yml (ligne `DJANGO_SETTINGS_MODULE`), api/config/settings/ | Créer `settings/prod.py` : DEBUG faux, hôtes explicites, cookies et en-têtes sécurisés derrière edge ; l'utiliser en prod | pytest needs ; démarrage en recette avec DEBUG faux |
| 2 | Secrets de prod avec valeur par défaut dans le compose : mot de passe de la base (l.42 et l.62), clé Django (l.57) | docker-compose.prod.yml | Remplacer par `${X:?variable requise}` | `docker compose config` échoue sans variable ; la recette redémarre avec les siennes |
| 2b | Clé d'écriture du catalogue : défaut vide (l.78) | docker-compose.prod.yml | Rendre obligatoire, avec la même clé côté planning | idem |
| 4 | Aucun `USER` dans les Dockerfiles : l'API tourne en root | api/Dockerfile, gateway/Dockerfile | Utilisateur non root ; retirer les outils de compilation de l'image finale | `docker exec <conteneur> id` différent de root ; l'API répond |
| 12 | Sans `OIDC_AUDIENCE`, l'audience du jeton n'est pas vérifiée | api/config/settings/base.py (l.96), api/core/auth/oidc.py | Refuser le démarrage si vide, comme comptes rendus (`oidc.py` l.26) | test : démarrage refusé sans audience, jeton sans `aud` refusé |
| 9 | Django 5.0.6 (fin de support) | api/requirements | Passer en 5.2 LTS, suite de tests complète | pytest vert |
| 11 | Copie de `jwt_verifier.py` identique à core et comptes rendus : ne pas la modifier seule | api/core/auth/jwt_verifier.py | Aucune action ici ; la décision (copies communes) est au plan | job `auth-commune` |

## Ne pas faire
- Changer les secrets de prod ou toucher au serveur : gelé tant que l'utilisateur n'a pas fixé la fenêtre (PLAN-secrets.md).
- Construire ou publier une image sans accord de la session de coordination (docs/engineering/coordination.md).

## Retour
Un commit par constat, puis un message court : constat, commit, preuve observée. Sentinelle relit avant toute mise en ligne.
