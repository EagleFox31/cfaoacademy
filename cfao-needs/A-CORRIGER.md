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
| KC | Le Keycloak propre à needs ne sert plus (décision du 19/11) : needs utilise le realm commun `cfao` (client `cfao-needs-web`), comme en prod | docker-compose.yml (services `needs-kc-db`, `needs-keycloak`, leur volume, `depends_on`, URL OIDC par défaut), dossier `keycloak/`, `KC_*` de .env.example, `.gitattributes` (ligne keycloak), README (section Keycloak), web/.env.example, commentaire de web/src/lib/auth.js, docs/SPEC_RECUEIL_BESOINS_2027.md | Tout retirer ; le compose de dev pointe sur le realm commun. Garder les tests edge qui exigent un 404 sur `/realms/cfao-needs` | `docker compose config` valide ; `git grep -n "needs-keycloak\|cfao-needs-realm\|KC_ADMIN"` ne renvoie rien dans cfao-needs ; needs de dev se connecte via le realm `cfao` |

## Ne pas faire
- Changer les secrets de prod ou toucher au serveur : gelé tant que l'utilisateur n'a pas fixé la fenêtre (PLAN-secrets.md).
- Construire ou publier une image sans accord de la session de coordination (docs/engineering/coordination.md).

## Retour
Un commit par constat, puis un message court : constat, commit, preuve observée. Sentinelle relit avant toute mise en ligne.
