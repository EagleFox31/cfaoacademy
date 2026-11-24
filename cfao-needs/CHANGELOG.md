# Nouveautés — Recueil des besoins

Une section par version publiée (`## [X.Y.Z] - AAAA-MM-JJ`). Avant de publier, renommer
`[Unreleased]` en numéro de version : `scripts/build_image.py` copie cette section dans
l'image (label `org.cfao.changelog`), affichée dans l'écran de supervision, et refuse une
version sans sa section. L'API et la passerelle ont des numéros distincts : préfixer
chaque puce par « API : » ou « Passerelle : ».

## [Unreleased]

## [0.2.5] - 2026-11-23

- API : les lignes du corps « niveaux du catalogue » portent `title` (intitulé du module), lu par planning pour nommer les sessions issues des fiches besoins. Contrat needs-analytics 1.7.0, champ facultatif, compatible avec les lecteurs 1.5 et 1.6.

## [0.2.4] - 2026-11-23

- API : une case bleue d'une fiche besoins = places attribuées à Douala (elle était lue comme « sans couleur »). Un nouvel import réaligne les compteurs des lignes déjà en base.
- API : le corps « besoins par filiale et marque » porte `assigned` : places attribuées (vert, bleu) par pays, marque, module et site (`academy`, `subsidiary`, `distance`). Contrat needs-analytics 1.6.0, compatible avec les lecteurs 1.5.
- API : la version des besoins change aussi quand le lieu d'un trimestre change (migration `analytics.0004`).

## [0.2.3] - 2026-11-23

- API : les fiches besoins sont lues aussi dans les sous-dossiers (« Mobility 2027 », « Equipment 2027 »), sans les formulaires vierges. Avec `--validated-by <classeur de suivi>`, seules les fiches validées sont importées (feuille RDV : case verte, rapport et calendrier « Yes ») ; les autres sont listées « EN ATTENTE ». Sept filiales de plus sont reconnues (Cameroun, Ghana, Burkina Faso, Mali, Bénin, Guinée, RD Congo).
- API : `import_need_workbooks --json` termine par une ligne `JSON {fichiers, compteurs}` (nom, empreinte, statut et lignes de chaque fiche ; places ajoutées, fiches créées, en attente), reprise par les événements d'import du serveur.
- Production : service ponctuel `needs-import` (profil `import`), qui lit le partage en lecture seule. Il est lancé par le script serveur de synchronisation des classeurs.

- Production : réglages dédiés (`config.settings.prod`) — débogage coupé, hôtes servis listés dans `NEEDS_ALLOWED_HOSTS` (obligatoire, `*` refusé au démarrage). Un en-tête Host inconnu reçoit 400.
- Audience des jetons obligatoire : sans `OIDC_AUDIENCE`, l'API, le worker et le relay refusent de démarrer (dev, prod) et tout jeton est refusé (401).

## [0.4.1] - 2026-11-20

- Passerelle : une ancienne version de l'application restée dans le navigateur recharge toute seule la nouvelle, au lieu d'une page blanche. Les anciens liens à la racine redirigent toujours vers `/besoins/`, sans que le navigateur garde cette redirection en mémoire.

## [0.4.0] - 2026-11-20

- Passerelle : l'application s'ouvre désormais à l'adresse `/besoins/`, comme les autres applications CFAO Academy. Les anciens liens à la racine redirigent vers `/besoins/`.
- Passerelle : la page d'accueil n'est plus gardée en cache par le navigateur ; une nouvelle version s'affiche sans vider le cache.
