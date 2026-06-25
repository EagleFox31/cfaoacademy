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

/** @returns {string | null} */
export function countryCodeFromName(name) {
  if (!name) return null
  return NAME_TO_CODE[norm(name)] ?? null
}

export function flagCdnUrlForCountry(name, width = 40) {
  const code = countryCodeFromName(name)
  if (!code) return null
  return `https://flagcdn.com/w${width}/${code}.png`
}
