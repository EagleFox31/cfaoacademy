# Comptes rendus : passage sous `/cr/` et autres changements

À lire avant d'intégrer une branche partie d'avant novembre, en particulier
`feature/04-5-amelioration` (PR #28). Tout est sur `feature/15-1-cerbos-pdp-unique`.

## Ce qu'il faut retenir

1. L'interface est servie sous `/cr/` : toute URL du module passe par `adresse()`.
2. Les migrations sont lancées par un job `migrate`, plus par l'API.
3. Le dossier `cfao-comptes-rendus/cerbos/` n'existe plus : les règles sont dans `cerbos/` à la racine.
4. La vérification des jetons est commune à tous les modules : ne pas modifier `jwt_verifier.py` dans le module.
5. Une image construite sans ces changements ramène l'interface à la racine. Il faut intégrer avant de livrer.

## 1. Pourquoi `/cr/`

Tous les modules passent désormais par une seule porte d'entrée, `cfao-edge`, qui les
distingue par le début de l'URL. Comptes rendus a le préfixe `/cr/`.

```
navigateur -> cfao-edge -> passerelle CR -> API
     /cr/cr-donnees/x    (préfixe gardé)     /cr-donnees/x (préfixe retiré)
```

| Élément | Comportement |
|---|---|
| Préfixe | Fixé au build par `CR_BASE` : `/cr/` dans l'image (`gateway/Dockerfile`), `/` en dev (`npm run dev`) |
| Routes React | `BrowserRouter basename` : `<Link to="/portail">` et `navigate()` ne changent pas |
| API | La passerelle retire `/cr` avant l'API : **aucun changement côté Django** |
| Anciens liens à la racine | Redirigés en 308 vers `/cr/...` |
| Cookie de session | Path `/cr/` |

### La règle à appliquer dans le code

Vite ne préfixe pas les chaînes écrites à la main. Une URL absolue marche donc en dev
(racine), puis casse en image (404). Tout appel API, image, ou fichier de `public/`
passe par `web/src/lib/adresse.js` :

```js
import { adresse } from '../lib/adresse'

fetch(adresse('/cr-donnees/brouillons'))     // et non fetch('/cr-donnees/brouillons')
const photo = adresse('/assets/publics/process-sav.jpg')
```

Cela ne concerne pas les routes de React Router, gérées par `basename`.

Pour vérifier qu'il ne reste rien (depuis `cfao-comptes-rendus/`) :

```sh
grep -rnE "['\"\`(]/(assets|apercu|cr-donnees|maintenance\.json)[/'\"\`.]" web/src --include=*.js --include=*.jsx --include=*.css | grep -v "adresse(\|test\."
```

Il doit rester seulement deux lignes, normales : un commentaire de
`brouillonsCompteRendu.js` et le test `includes('/cr-donnees/photos/')` de
`photosService.js` (il compare une partie de l'adresse, le préfixe n'y change rien).

## 2. Annonce de mise à jour et rechargement

- `maintenance.json` est maintenant dans `html/cr/` de la passerelle.
- À l'état `terminee`, un onglet qui a vu le compte à rebours enregistre, puis se recharge
  seul, une fois. Plus besoin de demander F5 aux utilisateurs.
- Un onglet resté sur une ancienne version qui demande un fichier JS disparu reçoit de la
  passerelle un petit script qui recharge la page (au plus une fois par 30 s et par
  onglet). Les fichiers absents qui ne sont pas du JS restent en 404.

Procédure complète : [MISE_A_JOUR.md](MISE_A_JOUR.md).

## 3. Job `migrate` (AGENTS.md §7)

`docker-compose.yml` et `docker-compose.prod.yml` ont un service `migrate` à usage unique
qui lance `manage.py migrate --noinput`, puis `manage.py compte_technique`. L'API attend
sa réussite (`service_completed_successfully`).

- Une base vide est prête sans commande manuelle ; sur une base à jour, le job ne change rien.
- Il n'y a plus de migration au démarrage de l'API : pas de concurrence entre conteneurs.
- Une nouvelle migration Django ne demande rien de plus.
- Si l'API ne démarre pas : `docker compose logs migrate`.

Le paragraphe de `MISE_A_JOUR.md` (étape 5) qui dit que l'API applique seule les
migrations décrit l'ancien fonctionnement.

## 4. Cerbos unique

Il n'y a plus qu'un serveur de droits et un seul jeu de règles pour toute la plateforme.

| Avant | Maintenant |
|---|---|
| `cfao-comptes-rendus/cerbos/policies/resource_policies/` | `cerbos/policies/resource_policies/comptes_rendus/` |
| `cfao-comptes-rendus/cerbos/policies/_schemas/` | `cerbos/policies/_schemas/comptes_rendus/` |
| Tests dans le module | `cerbos/tests/comptes_rendus/` |

- En dev, le compose du module ne lance plus Cerbos. À la racine du dépôt, d'abord :
  `docker compose up -d cerbos`.
- L'image `cfao-comptes-rendus-cerbos` se construit depuis `../cerbos` (voir
  [PUBLIER_IMAGES.md](PUBLIER_IMAGES.md)).
- Une règle du module s'écrit dans `cerbos/`. La CI refuse un bundle propre à un module.

## 5. Vérification des jetons commune

`api/core/auth/jwt_verifier.py` est copié à l'identique dans les modules. Un job CI
(`auth-commune`) refuse toute copie divergente : un changement se fait dans
`cfao-core/core/auth/jwt_verifier.py`, puis se recopie.

- L'émetteur doit être exactement égal à `OIDC_ISSUER` ou à une entrée de
  `OIDC_TRUSTED_ISSUERS` (format `emetteur=jwks;...`).
- `OIDC_AUDIENCE` accepte une liste.
- Seul RS256 est accepté. Un refus donne un 401 sans détail, journalisé en info.

## 6. Intégrer la branche

La PR #28 ne touche ni à Cerbos, ni aux composes, ni à la passerelle : son contenu L0 n'est
pas remis en cause. Une fusion de `feature/15-1-cerbos-pdp-unique` dans
`feature/04-5-amelioration` a été simulée sur `73b1434` et `709ca50` : **2 conflits
seulement**. Une série de cherry-picks en donne davantage, la fusion est préférable.

```sh
git fetch origin
git checkout feature/04-5-amelioration
git merge origin/feature/15-1-cerbos-pdp-unique
```

| Fichier en conflit | Résolution |
|---|---|
| `web/src/components/AnnonceMaintenance.jsx` | Garder le côté 15-1 (il appelle `toutEnregistrer()` avant de recharger) |
| `web/src/pages/Accueil.jsx` | Garder les lignes 15-1 et préfixer aussi la carte de ta branche : `journal: adresse('/assets/img_cards/process_sav_equipment.png')` |

La fusion apporte aussi le reste de 15-1, dont le module planning. Sur la base actuelle de
la PR (`feature/04-5-rapports-formateur`), ce contenu apparaîtrait dans son diff : la base
de la PR est à revoir au moment de la fusion.

Commits concernés, si tu veux les lire :

| Commit | Date | Objet |
|---|---|---|
| `354a90e` | 28/10 | Bundle Cerbos unique |
| `e72d1e8` | 28/10 | Vérification JWT commune |
| `bcc9ce7` | 03/11 | Job `migrate` dev et prod |
| `f6b8856` | 04/11 | Service sous `/cr/` derrière `cfao-edge` |
| `d50d0bb` | 05/11 | Rechargement automatique des onglets |
| `996f35d` | 06/11 | Comptes rendus joint le Cerbos de la plateforme |

## 7. Vérifier après intégration

À la racine du dépôt :

```sh
make test-cr-web     # tests de l'interface du module
make test-cerbos     # compile et teste le bundle commun, si les règles ont changé
```

Puis dans `cfao-comptes-rendus/web/` :

```sh
CR_BASE=/cr/ npm run build
grep -c '"/cr/assets/' dist/index.html    # différent de 0
```

Le test qui compte vraiment : construire l'image de la passerelle, se connecter sous
`/cr/`, ouvrir un compte rendu et vérifier les notes, le seuil, les images et l'export
Excel. En dev à la racine, une URL oubliée ne se voit pas.

Pour le L0, le seuil, la virgule et l'export sont les parcours à refaire sous `/cr/`, car
ils passent par `PhaseVerification.jsx`, `exportEvaluation.js` et `exportResultats.js`.
