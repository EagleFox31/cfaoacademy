/**
 * Logos de marque et drapeaux pays.
 *
 * Les noms de fichiers reprennent ceux de la vitrine (`/assets/flags/<pays>.svg`)
 * pour qu'un drapeau ajouté d'un côté se retrouve de l'autre sans renommage.
 * Les logos, eux, sont nommés d'après le **code de marque du référentiel** :
 * c'est la seule clé stable, le libellé change (« OMODA & JAECCO » vs
 * « OMODA & JAECOO ») alors que le code, non.
 */

/**
 * Chemin du logo, sans vérifier que le fichier existe.
 *
 * Pas de liste blanche : elle obligerait à modifier ce fichier à chaque logo
 * déposé dans `public/assets/brands`, et un oubli masque un logo pourtant
 * présent — c'est arrivé pour FIAT et JEEP. `BrandLogo` bascule sur le
 * monogramme via `onError`, ce qui couvre déjà le fichier manquant.
 */
export function brandLogo(code) {
  return code ? `/assets/brands/${code}.png` : null
}

const COUNTRY_FLAGS = {
  algerie: 'algeria.svg',
  angola: 'angola.svg',
  benin: 'benin.svg',
  'burkina faso': 'burkina-faso.svg',
  cameroun: 'cameroon.svg',
  congo: 'congo.png',
  "cote d'ivoire": 'ivory-coast.svg',
  france: 'france.svg',
  gabon: 'gabon.svg',
  ghana: 'ghana.svg',
  'guinee equatoriale': 'equatorial-guinea.svg',
  kenya: 'kenya.svg',
  madagascar: 'madagascar.svg',
  malawi: 'malawi.svg',
  mali: 'mali.svg',
  maroc: 'morocco.svg',
  maurice: 'mauritius.svg',
  mozambique: 'mozambique.svg',
  niger: 'niger.svg',
  nigeria: 'nigeria.svg',
  'republique centrafricaine': 'central-african-republic.svg',
  senegal: 'senegal.svg',
  tanzanie: 'tanzania.svg',
  tchad: 'chad.svg',
  togo: 'togo.svg',
  tunisie: 'tunisia.svg',
  zambie: 'zambia.svg',
}

/** Accents et apostrophes typographiques varient selon la source de la donnée. */
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .trim()
    .toLowerCase()
}

export function countryFlag(country) {
  const file = COUNTRY_FLAGS[normalize(country)]
  return file ? `/assets/flags/${file}` : null
}
