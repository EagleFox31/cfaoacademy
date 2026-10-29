# Étude — journal des erreurs des comptes rendus (04-5)

## Besoin
Après une mise à jour de la prod, l'équipe technique doit retrouver, depuis l'interface et par un lien dédié, toutes les erreurs survenues chez les formateurs (aperçu refusé, rapport non produit, exception du service), avec assez de détail pour diagnostiquer sans accès au poste.

## Existant
- Le service (`cfao-comptes-rendus/api`) renvoie « rendu impossible » sans détail au portail (volontaire : ni chemin ni message interne) et écrit la pile dans les logs du processus, perdus au redémarrage.
- Le portail passe l'aperçu en « indisponible » ou affiche un échec de rapport sans rien transmettre.
- Toute route du service passe par le PEP Cerbos (default-deny) ; SQLite en local, Postgres en conteneur.

## Options
| Option | Pour | Contre |
|---|---|---|
| Fichier de log + lecture du fichier | Simple | Pas d'accès depuis l'interface ; rotation à gérer |
| Outil externe (Sentry…) | Riche | Nouveau fournisseur, données hors réseau, coût |
| **Table `Erreur` dans le service + page portail** | Même base, même autorisation, aucun fournisseur | Volume à borner |

## Choix
Table `Erreur` (date, origine service/portail, utilisateur, action, message, pile, contexte JSON) :
- côté service : chaque échec de rendu, de tâche de fond, et toute exception non rattrapée (middleware) ;
- côté portail : `POST /cr-donnees/erreurs` pour ce que seul le navigateur voit (délai, coupure, 5xx du proxy) ;
- lecture : `GET /cr-donnees/erreurs` (ressource Cerbos `compte_rendu_journal`, lecture réservée à `superadmin`) ; page `/portail/journal-erreurs`, absente des menus.

## Impacts
- Migration `0003_erreur`. Rétention : 90 jours et 2000 lignes au plus ; textes tronqués (20 000 car.), contexte (10 000).
- Sécurité : les formateurs peuvent écrire (create) mais pas lire ; la pile n'est visible que de l'équipe technique. Aucune donnée de stagiaire n'est mise dans le contexte (numéros de diapositive, page, navigateur).
- Un échec d'écriture du journal est avalé : il ne casse jamais une requête.

## Mise en service
Créer un compte technique : profil avec le rôle `superadmin` dans `profils.json`, puis `python manage.py mot_de_passe <identifiant>`. Ouvrir `/portail/journal-erreurs` connecté avec ce compte.
