function norm(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Noms wireframe / réseau → code ISO (flagcdn). */
const NAME_TO_CODE = {
  maroc: 'ma',
  mauritanie: 'mr',
  maurice: 'mu',
  'la reunion': 're',
  reunion: 're',
  djibouti: 'dj',
  'guinee equatoriale': 'gq',
  senegal: 'sn',
  gambie: 'gm',
  'guinee-bissau': 'gw',
  guinee: 'gn',
  'sierra leone': 'sl',
  liberia: 'lr',
  "cote d'ivoire": 'ci',
  mali: 'ml',
  'burkina faso': 'bf',
  ghana: 'gh',
  togo: 'tg',
  benin: 'bj',
  niger: 'ne',
  nigeria: 'ng',
  tchad: 'td',
  cameroun: 'cm',
  cameroon: 'cm',
  'ivory coast': 'ci',
  rca: 'cf',
  rci: 'ci',
  rge: 'ga',
  rdc: 'cd',
  france: 'fr',
  congo: 'cg',
  gabon: 'ga',
  kenya: 'ke',
  tanzanie: 'tz',
  ouganda: 'ug',
  rwanda: 'rw',
  burundi: 'bi',
  zambie: 'zm',
  zimbabwe: 'zw',
  madagascar: 'mg',
  angola: 'ao',
  ethiopie: 'et',
  mozambique: 'mz',
  malawi: 'mw',
}

const LOCAL_COUNTRY_FLAGS = {
  cameroun: '/assets/flags/cameroon.svg',
  cameroon: '/assets/flags/cameroon.svg',
  "cote d'ivoire": '/assets/flags/ivory-coast.svg',
  rci: '/assets/flags/ivory-coast.svg',
  'ivory coast': '/assets/flags/ivory-coast.svg',
  senegal: '/assets/flags/senegal.svg',
  maroc: '/assets/flags/morocco.svg',
  morocco: '/assets/flags/morocco.svg',
  rdc: '/assets/flags/democratic-republic-of-congo.svg',
  'congo kinshasa': '/assets/flags/democratic-republic-of-congo.svg',
  'dr congo': '/assets/flags/democratic-republic-of-congo.svg',
  ghana: '/assets/flags/ghana.svg',
  madagascar: '/assets/flags/madagascar.svg',
  gabon: '/assets/flags/gabon.svg',
  nigeria: '/assets/flags/nigeria.svg',
  'burkina faso': '/assets/flags/burkina-faso.svg',
  burkina: '/assets/flags/burkina-faso.svg',
  togo: '/assets/flags/togo.svg',
  benin: '/assets/flags/benin.svg',
  tchad: '/assets/flags/chad.svg',
  chad: '/assets/flags/chad.svg',
  congo: '/assets/flags/congo.svg',
  'congo brazzaville': '/assets/flags/congo.svg',
  mali: '/assets/flags/mali.svg',
  guinee: '/assets/flags/guinea.svg',
  'guinee-conakry': '/assets/flags/guinea.svg',
  mauritanie: '/assets/flags/mauritania.svg',
  mauritania: '/assets/flags/mauritania.svg',
  rca: '/assets/flags/central-african-republic.svg',
  centrafrique: '/assets/flags/central-african-republic.svg',
  'republique centrafricaine': '/assets/flags/central-african-republic.svg',
  'guinee equatoriale': '/assets/flags/equatorial-guinea.svg',
  rge: '/assets/flags/equatorial-guinea.svg',
  niger: '/assets/flags/niger.svg',
  kenya: '/assets/flags/kenya.svg',
  tanzanie: '/assets/flags/tanzania.svg',
  angola: '/assets/flags/angola.svg',
  france: '/assets/flags/france.svg',
  all: '/assets/flags/africa-cfao-network.jpg',
  groupe: '/assets/flags/africa-cfao-network.jpg',
  'toutes filiales': '/assets/flags/africa-cfao-network.jpg',
  'toutes les filiales': '/assets/flags/africa-cfao-network.jpg',
}

/** Codes ISO (alpha-3 du référentiel planning, alpha-2 accepté) → fichier local. */
const ISO_FLAG_FILES = {
  all: 'groupe-cfao', // choix « toutes les filiales »
  cmr: 'cameroon', cm: 'cameroon',
  civ: 'ivory-coast', ci: 'ivory-coast',
  sen: 'senegal', sn: 'senegal',
  cod: 'democratic-republic-of-congo', cd: 'democratic-republic-of-congo',
  cog: 'congo', cg: 'congo',
  gab: 'gabon', ga: 'gabon',
  ben: 'benin', bj: 'benin',
  bfa: 'burkina-faso', bf: 'burkina-faso',
  mdg: 'madagascar', mg: 'madagascar',
  mar: 'morocco', ma: 'morocco',
  mrt: 'mauritania', mr: 'mauritania',
  ner: 'niger', ne: 'niger',
  caf: 'central-african-republic', cf: 'central-african-republic',
  gnq: 'equatorial-guinea', gq: 'equatorial-guinea',
  tcd: 'chad', td: 'chad',
  tgo: 'togo', tg: 'togo',
  mli: 'mali', ml: 'mali',
  gin: 'guinea', gn: 'guinea',
  gha: 'ghana', gh: 'ghana',
  ken: 'kenya', ke: 'kenya',
  nga: 'nigeria', ng: 'nigeria',
  tza: 'tanzania', tz: 'tanzania',
  gmb: 'gambia', gm: 'gambia',
  gnb: 'guinea-bissau', gw: 'guinea-bissau',
}

/** Drapeau local d'un code pays ISO (aucun CDN) ; null si inconnu. */
export function flagUrlForIso(code) {
  const file = code ? ISO_FLAG_FILES[String(code).trim().toLowerCase()] : null
  return file ? `/assets/flags/${file}.svg` : null
}

/** @returns {string | null} */
export function countryCodeFromName(name) {
  if (!name) return null
  return NAME_TO_CODE[norm(name)] ?? null
}

export function localFlagUrlForCountry(name) {
  if (!name) return null
  return LOCAL_COUNTRY_FLAGS[norm(name)] ?? null
}

export function flagCdnUrlForCountry(name, width = 40) {
  const code = countryCodeFromName(name)
  if (!code) return null
  return `https://flagcdn.com/w${width}/${code}.png`
}

export function flagUrlForCountry(name, width = 64) {
  return localFlagUrlForCountry(name) || flagCdnUrlForCountry(name, width)
}
