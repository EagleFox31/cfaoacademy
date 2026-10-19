# ADR 0002 — Module des comptes rendus détachable

- **Statut** : accepté
- **Date** : 2026-10-14
- **Story** : `04-5` — rédiger un rapport post-formation
- **Complète** : [ADR 0001](0001-service-rapports-formateur.md) (service de rendu, déjà remplacé par `cfao-comptes-rendus/`)

## Contexte

Les comptes rendus des formateurs doivent pouvoir être mis à disposition sans le reste de la
plateforme (pas de portail complet, pas de Keycloak à exploiter pour quelques dizaines de
comptes), tout en restant branchables sur elle plus tard. L'interface vivait dans `frontend/`,
mêlée au portail, et le module n'avait ni point d'entrée ni base propres à son déploiement seul.

## Décision

1. **Un dossier autonome** : `cfao-comptes-rendus/` contient l'interface (`web/`), le service
   (`api/`), les règles Cerbos et une passerelle nginx. Il se lance avec son propre
   `docker-compose.yml` ; le portail n'y renvoie que par `VITE_CR_URL`
   (`http://localhost:8090` par défaut).
2. **Un port dédié** : la passerelle est seule publiée (`${CR_BIND:-127.0.0.1}:${CR_PORT:-8090}`).
3. **Base PostgreSQL** pour la pile autonome (le réglage lit `DATABASE_URL`). La plateforme
   garde pour l'instant SQLite sur le volume du service `rapports` ; le code accepte les deux.
4. **Deux modes détachés** : `local` (prod interne, comptes à mot de passe créés par
   `manage.py mot_de_passe`) et `standalone` (poste de développement, profils fictifs).
   **Pas de Keycloak propre au module.**
5. **Mode `integrated`** : le module s'appuie sur le Keycloak de la plateforme (`OIDC_*`) ;
   on n'y crée jamais un realm dédié.

6. **Exposer en interne** : la liaison reste `127.0.0.1` tant qu'aucun reverse proxy TLS ne
   précède la passerelle. Pour un usage réel sur le réseau interne : reverse proxy TLS devant
   la passerelle (ou `CR_BIND` élargi sur un réseau de confiance), `COOKIE_SECURE=True`
   derrière HTTPS, `ORIGINES_AUTORISEES` (origine publique exacte ; les requêtes qui écrivent
   et viennent d'une autre origine, ou portent le cookie sans `Origin` ni `Referer`, sont
   refusées en 403), `ALLOWED_HOSTS` (nom public), mode `local` et `DEBUG=False`. Le cookie de
   session du module est nommé `cfao_cr_session` (même hôte, ports différents = même site).
   Détail : [README du module](../../cfao-comptes-rendus/README.md#exposer-en-interne).

## Écart voulu avec `cfao-needs`

`cfao-needs` (recueil des besoins) embarque sa propre pile Keycloak, ce que ce module ne fait
pas : une seconde instance Keycloak (JVM, base, realm à maintenir) est disproportionnée pour le
volume de comptes visé, et deux realms séparés rendraient le futur SSO plus difficile. Le reste
du modèle est repris (passerelle nginx, Cerbos default-deny, base PostgreSQL, port dédié).

## Conséquences

- Une seule commande démarre le module ; les mots de passe locaux sont gérés hors annuaire
  (empreintes scrypt sur le volume du service), à sauvegarder avec la base.
- Le mode `local` n'offre pas de SSO : un formateur a un identifiant propre au module.
- Deux chemins de déploiement à garder cohérents (compose du module, compose racine) : ils
  partagent `api/Dockerfile` et les mêmes règles Cerbos.

## Condition de révision

À réviser quand le mode `integrated` sera en service avec le SSO de la plateforme : le mode
`local` et la gestion des mots de passe du module pourront alors être retirés.
