# Plan : changer les secrets (prod)

Porteur : sentinelle (ordre et preuves). Exécution serveur : l'utilisateur (verrou `deploy:serveur`, accord préalable de manitou). Rien dans ce plan ne s'exécute sans accord de l'utilisateur.

## Pourquoi
Le dépôt est public jusqu'au début de décembre : les valeurs par défaut écrites dans les compose sont à considérer comme connues. Le changement des secrets les rend inutiles. **Pas de purge de l'historique git** (recommandation, à confirmer) : elle casse les branches et les worktrees, et ne rattrape pas les copies déjà faites.

## Ce qui est concerné (relevé sur le disque, valeurs non recopiées)
| Secret | Où il a une valeur par défaut | Effet du changement |
|---|---|---|
| Mot de passe de la base needs | cfao-needs/docker-compose.prod.yml l.42 et l.62 | À changer dans la base ET dans le .env : sinon needs ne se connecte plus |
| Clé secrète Django de needs | cfao-needs/docker-compose.prod.yml l.57 | Les sessions et jetons signés par needs deviennent invalides (reconnexion) |
| Mot de passe admin Keycloak de démarrage | cfao-needs/docker-compose.yml l.47 | À vérifier : valeur identique en prod ? |
| Mot de passe de la base Keycloak | docker-compose.yml l.15-16, 36-37 (racine) | Idem : à changer base + .env |
| Clés d'échange needs / planning (analytics, snapshot) | cfao-needs/docker-compose.yml l.128, 134 ; cfao-planning/docker-compose.yml l.61 ; docker-compose.yml l.152 | Les deux côtés doivent changer en même temps |
| Clé du service mail du hub | edge/compose.dev.yml l.57 | À vérifier : réutilisée en prod ? |
| Secret du portail (smoke Keycloak) | keycloak/tests/docker-compose.smoke.yml l.35 | Test seulement ; à vérifier s'il sert ailleurs |

| Poivre du code de connexion par e-mail (`CODE_PEPPER`) | keycloak/tests/compose.hub.smoke.yml l.46 | Test seulement ; à vérifier que la prod a un poivre propre (sinon les codes de connexion se devinent) |
| Clé secrète et mot de passe de base du service mail | keycloak/tests/compose.hub.smoke.yml l.12, 24, 75 | Test seulement ; même vérification que le hub mail en prod |
| Mots de passe de dev du compose edge (base, Keycloak, admin, secret du portail) | edge/compose.dev.yml l.28, 44, 46, 89, 95 | Dev seulement ; vérifier que la prod ne les reprend pas |
| Mot de passe de la base core et du service comptes rendus | aucun défaut | Relu le 19/11 : core, comptes rendus, supervision et planning exigent déjà chaque secret (`${X:?...}`), sauf la clé d'écriture du catalogue (défaut vide, voir ci-dessous) |
| Clé d'écriture du catalogue (`NEEDS_CATALOG_WRITE_KEY` côté planning l.60, `NEEDS_CATALOG_WRITE_INBOUND_KEY` côté needs l.78) | défaut **vide** des deux côtés | Pas une valeur connue, mais un défaut vide laisse l'échange sans clé : à rendre obligatoire avec les autres |

**Relevé du 19/11 (lecture des compose de prod, valeurs non recopiées)** : seul cfao-needs a des valeurs par défaut réelles, aux lignes 42 (mot de passe base, 24 caractères), 57 (clé Django, 64 caractères) et 62 (mot de passe base). Les autres modules sont déjà conformes : le travail dans le dépôt se limite à needs et à la clé du catalogue.

Les lignes dev et test ne sont un risque que si le serveur utilise les mêmes valeurs.

## Étapes
1. **Inventaire en lecture seule sur le serveur** (accord requis) : pour chaque secret ci-dessus, le `.env` du serveur utilise-t-il la valeur par défaut du dépôt, ou une valeur propre ? Ne changer que ce qui est identique ou douteux. Résultat noté sans écrire les valeurs.
2. **Dans le dépôt** (cfao-planning, zone cfao-needs) : retirer les valeurs par défaut des secrets de prod (`${X:?variable requise}`), pour que la prod refuse de démarrer sans valeur. Preuve : `docker compose config` échoue sans variable ; la recette 8088 démarre avec les siennes. Un commit par constat.
3. **Générer les nouvelles valeurs sur le serveur** (jamais dans le dépôt, jamais dans une conversation) : `openssl rand -base64 48` par secret, dans le `.env` du module, droits 600.
4. **Sauvegarde avant** : dump de la base needs et de la base Keycloak, copie des `.env`.
5. **Fenêtre de changement** (à fixer par l'utilisateur) : hors heures de formation. Ordre : base needs (changer le mot de passe dans Postgres, puis le .env) → clé Django needs → clés d'échange needs/planning des deux côtés → Keycloak. Coupure attendue : redémarrage de needs, quelques minutes ; reconnexion des utilisateurs.
6. **Preuve après** : needs répond via edge, une connexion complète fonctionne (Keycloak → portail), l'ancien mot de passe de base est refusé, `docker compose config` ne contient aucune valeur du dépôt.
7. **Clôture** : sentinelle ajoute une entrée dans lessons-learned.md (valeur par défaut secrète dans un compose de prod) avec le contrôle qui l'empêche de revenir (test ou CI qui refuse un défaut sur une variable `*_PASSWORD`, `*_SECRET*`, `*_KEY`).

## Décisions de l'utilisateur (19/11)
- Pas de purge de l'historique git.
- Needs : personne ne l'utilise pour l'instant, donc pas de fenêtre à protéger pour needs. Keycloak (identity) est utilisé : ses changements, s'il y en a, se font vite et hors heures de travail.
- Inventaire du serveur en lecture seule : accordé, fait le 19/11 (manitou, verrou rendu).

## Résultat de l'inventaire serveur (19/11, valeurs jamais affichées)
- Aucun secret du serveur n'est égal à une valeur par défaut du dépôt, sauf ceux **laissés vides** dans cfao-needs/.env : NEEDS_DB_PASSWORD, KC_ADMIN_PASSWORD, KC_DB_PASSWORD. Une valeur vide fait retomber le compose sur sa valeur par défaut publique. Les changer.
- cfao-planning/.env : NEEDS_CATALOG_WRITE_KEY vide (à comprendre : clé inutilisée ou écriture du catalogue sans clé).
- Les clés partagées entre deux fichiers (analytics core/needs/planning, snapshot needs/planning) sont les clés d'échange, voulues identiques.
- Tous les autres secrets sont propres (longueur suffisante, valeurs propres au serveur).

## À décider par l'utilisateur (reste)
- Purge de l'historique : non (recommandé).
- Fenêtre de changement : jour et heure.
- Accord pour l'inventaire en lecture seule sur le serveur (étape 1).
