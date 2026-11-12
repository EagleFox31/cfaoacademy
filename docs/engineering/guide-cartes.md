# Guide des cartes

À lire avant de poser une carte sur un écran. Il applique RAIDER à l'interface
([RAIDER.md](../../RAIDER.md), AGENTS.md §6) : on cherche d'abord la carte qui
existe pour ce type de contenu, on la reprend, et on nomme le composant repris
dans le compte rendu de livraison.

Les chemins sont relatifs à `frontend/src/`. Tout le CSS est global
(`styles/academy.css`, `styles/portal.css`).

## 1. Quelle carte pour quel contenu

C'est le tableau à consulter en premier. Si le contenu figure ici, on reprend le
composant indiqué, sans en fabriquer un autre.

| Contenu à montrer | Composant | Référence à l'écran |
|---|---|---|
| Une marque et son offre de formations (catalogue) | `BrandOfferGrid` › `CardRail` › `BrandCard` | Accueil, « Nos offres de formations techniques » |
| Une marque comme porte d'entrée vers des résultats ou un plan | `PlanEntryCard` avec `logo` (grand logo centré) | Portail DPS, résultats par marque |
| Un plan de formation (PIF) qui couvre plusieurs marques | `PlanEntryCard kind="pif"` + pastilles `PortalBrandLogo size="chip"` | Portail DPS, PIF par filiale |
| Une campagne, une année, un écran à ouvrir | `PvCard` avec `img`, `kicker` (pastille de statut), `corner` | Portail DPS, besoins en formations |
| Un écran annoncé, pas encore disponible | `PvCard` sans lien, pastille `portal-status-chip todo`, `cardMedia={<PortalConstructionMedia label=… />}` (jamais l'image par défaut) | Portail du centre, « À suivre » |
| Une formation du catalogue (carrosserie, SAV) | `CatalogTrainingCard` (PvCard `variant="doc"`) | Accueil, carrosserie et SAV |
| La même formation dans un portail | `CatalogTrainingCard portal` : pied en icônes, œil à gauche (voir), crayon à l'extrême droite (modifier) | Portail du centre, offres |
| Un public (technicien, manager, client) | `PublicCard` (PvCard `corner` + `accentColor`) | Accueil, « Publics » |
| Un article | `ArticleCard` dans un `CardRail` | Accueil, « Actualités » |
| Un ticket d'assistance | `PvCard` + `DpsTicketCardMedia` | Portail DPS, assistance |
| Un témoignage | `TestimonialShowcase` | Accueil, « Témoignages » |

Règle sur les marques : partout où le nom d'une marque apparaît, son logo
apparaît. Une marque ne se montre jamais avec une `PvCard` générique et un petit
logo dans le corps de la carte.

## 2. Les cartes de la page d'accueil (`pages/Accueil.jsx`)

Chaque section s'ouvre avec `PreviewSection` (numéro, sur-titre, titre).

| Section | Type de contenu | Mise en page | Carte |
|---|---|---|---|
| Actualités | Articles | Rail horizontal `CardRail` | `ArticleCard` |
| Publics | Profils visés | Grille | `PublicCard` |
| Offres Motors | Marques véhicules légers | Rail `brand-offer-rail` | `BrandCard` |
| Offres Equipment | Marques engins, camions, bus, chariots | Rail `brand-offer-rail` | `BrandCard` |
| Carrosserie, SAV | Formations du catalogue | Grille | `CatalogTrainingCard` |
| Expertise | Atouts de l'Academy | Grille | `PvCard` |
| Assistance | Services | `PvCardGrid` | `PvCard` |
| Témoignages | Citations | Vitrine | `TestimonialShowcase` |

### Les offres de formations (`components/HomeOfferSections.jsx`)

Les cinq sections d'offres (véhicules légers, engins et poids lourds,
carrosserie, organisation SAV Motors, organisation SAV Equipment) forment un
seul composant, sans prop : `<HomeOfferSections />`. L'accueil et le portail du
directeur du centre l'affichent tous les deux. Pour montrer les offres ailleurs,
on pose ce composant ; on ne recompose pas les sections à la main.

### La carte de marque (`components/BrandCard.jsx`)

- Appel : `<BrandCard brand={b} />`, toujours à travers
  `<BrandOfferGrid brands={liste} />`, qui fournit le rail et ses flèches.
- Ce qu'elle montre, de haut en bas : grand logo sur fond blanc, compteur de
  sessions (`brand.n`), catégorie, nom, formateur, mention « Catalogue PDF ».
- Au clic : le catalogue PDF de la marque s'il existe, sinon la page Formations.
  Une marque dont le catalogue n'est pas prêt est affichée verrouillée
  (« Bientôt »).
- Données : `BRANDS` dans `data/index.js`. Les listes par pôle sont
  `MOTORS_BRANDS` et `EQUIPMENT_BRANDS`, exportées du même fichier.
- Limite : le compteur vient de `brand.n`, il n'y a pas de prop pour un autre
  chiffre. Pour afficher autre chose que l'offre (résultats, besoins), on prend
  `PlanEntryCard`, on ne détourne pas `BrandCard`.

## 3. Les cartes du portail DPS (`pages/portal/DpsDashboard.jsx`)

Le portail DPS est la référence validée des portails de rôle.

| Section | Type de contenu | Mise en page | Carte |
|---|---|---|---|
| Besoins en formations | Une campagne par année | `.pv-grid.cols-3` | `PvCard` |
| Résultats des collaborateurs | Une entrée par marque | `PortalStaggerGrid` 4 colonnes | `PlanEntryCard kind="results"` |
| Résultats par palier | Junior, Senior, Expert | `PortalStaggerGrid` | `PlanEntryCard` |
| PIF par filiale | Un plan, plusieurs marques | `PortalStaggerGrid` | `PlanEntryCard kind="pif"` |
| Assistance | Tickets | Grille | `PvCard` + `DpsTicketCardMedia` |

### `PlanEntryCard` (`components/PlanEntryCard.jsx`)

Enveloppe `PvCard`. Avec `logo`, elle affiche le logo de la marque en grand,
centré dans le visuel (`.portal-plan-entry-card-img--brand`).

Props : `kind`, `title`, `desc`, `meta`, `cta`, `hoverHint`, `accentColor`,
`logo`, `brandLabel`, `statusChip`, `href`, `to`, `onOpen`, `corner`,
`cardMedia`, `kicker`, `isComingSoon`, `noMedia`.

## 4. La carte de base : `PvCard`

Props : `kicker`, `title`, `meta`, `variant`, `corner`, `to`, `href`, `onClick`,
`secondCta`, `secondCtaTo`, `actions`, `img`, `imgFallback`, `imgPosition`, `cardMedia`,
`noMedia`, `logo`, `brandLabel`, `brandAside`, `cta`, `ctaAside`, `accentColor`,
`hoverHint`, `selected`, `className`.

À savoir :

- Sans `img`, elle affiche l'image par défaut.
- `logo` pose un petit logo dans le corps de la carte (42 px dans le portail).
  Elle ne sait pas afficher un grand logo centré : pour cela, `PlanEntryCard`.
- Les données d'une carte s'écrivent comme dans le portail DPS : une rangée de
  cases, libellé en haut, valeur dessous (`portal-team-member-subcards`). On
  passe `<PortalCardKpis items={[{ value, total, unit, label }]} />` dans `meta`.
  Jamais une phrase grise, jamais un autre habillage de chiffres.
- L'année d'une carte s'écrit une seule fois : dans le titre, ou dans la
  pastille d'année (`portal-campaign-year-chip`, à côté de la pastille de statut
  dans un `pv-card-kicker-row`), jamais les deux.
  Dans le titre, l'année prend la couleur de sa pastille
  (`portal-card-year--future|current|past`).
- La flèche du `cta` est ajoutée par la carte. Ne pas écrire `→` dans le texte.
- `actions` remplace le pied de carte par des icônes (`.pv-card-action`), réparties
  aux deux extrémités. Dans un portail : voir à gauche, modifier à droite.
- Le statut se met dans `kicker`, avec une pastille `portal-status-chip`
  (`done`, `progress`, `open`, `closed`, `todo` ; couleurs dans AGENTS.md §2).

## 5. Mise en page

| Besoin | Composant |
|---|---|
| Grille du portail, apparition en cascade | `PortalStaggerGrid`, chaque carte dans `.portal-card-anchor` |
| Grille simple | `.pv-grid` avec `.cols-3` ou `.cols-4` |
| Rail horizontal avec flèches | `CardRail` (`visibleCount`, `peek`, `gap`, `arrows`) |
| Cartes en cours de chargement | `PortalSectionSkeleton` (`cols`, `count`, `ariaLabel`) : jamais de section vide pendant un appel |
| En-tête de section, accueil | `PreviewSection` |
| En-tête de section, portail | `.portal-section-head` (sur-titre + titre) |

## 6. Avant d'ajouter une carte

1. Chercher le contenu dans le tableau du §1.
2. S'il y est : reprendre le composant tel quel (Adopt).
3. S'il manque une information : ajouter une prop au composant existant (Adapt),
   pas une copie.
4. S'il n'y a rien de proche : regarder comment l'accueil et le portail DPS
   traitent un contenu voisin (Learn), puis seulement construire (Build), et
   ajouter la nouvelle carte à ce guide.
5. Dans le compte rendu de livraison, nommer le composant repris et la décision.

## 7. Écarts connus, à ne pas reproduire

Ce sont des dettes relevées pendant l'inventaire. Elles ne servent pas de modèle.

- Cinq sources de logos de marque : `BRANDS` (`data/index.js`),
  `utils/cardBrandBadge.js`, `components/PortalBrandLogo.jsx`,
  `utils/teamBrands.js`, `pages/Formations.jsx`. Pour une nouvelle carte, partir
  de `BRANDS`.
- Deux carrousels : `CardRail` et `CardCarousel`. Prendre `CardRail`.
- Trois façons d'écrire un en-tête de section (`PreviewSection`,
  `PortalSectionHead`, `.portal-section-head` écrit à la main).
- Du français écrit en dur dans plusieurs composants (par exemple le libellé
  d'accessibilité « Marques » de `BrandOfferGrid`). Tout nouveau texte passe par
  `useLocale`.
- Code mort : la prop `showAll` passée à `BrandOfferGrid`, `KpiBand`,
  `CatalogueOfferCard`.
