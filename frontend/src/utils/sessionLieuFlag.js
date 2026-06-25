import { PAYS } from '../data/index.js'

/** Villes CFAO Academy → pays (code ISO flagcdn). */
const CITY_TO_CODE = {
  douala: 'cm',
  yaounde: 'cm',
  yaoundé: 'cm',
  abidjan: 'ci',
  lome: 'tg',
  lomé: 'tg',
  dakar: 'sn',
  lagos: 'ng',
  accra: 'gh',
  cotonou: 'bj',
  libreville: 'ga',
}

/** Abréviations réseau → code pays. */
const ALIAS_TO_CODE = {
  rci: 'ci',
  rge: 'ga',
  cameroun: 'cm',
  'cote divoire': 'ci',
  "cote d'ivoire": 'ci',
  'côte d\'ivoire': 'ci',
  'côte divoire': 'ci',
  'burkina faso': 'bf',
  benin: 'bj',
  bénin: 'bj',
  senegal: 'sn',
  sénégal: 'sn',
  madagascar: 'mg',
  nigeria: 'ng',
  togo: 'tg',
  niger: 'ne',
  congo: 'cg',
  rdc: 'cd',
  ghana: 'gh',
  france: 'fr',
  francaise: 'fr',
  française: 'fr',
}

function norm(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const PAYS_BY_NORM = Object.fromEntries(PAYS.map((p) => [norm(p.name), p]))

/** @returns {{ code: string, label: string } | null} */
export function flagForSessionLieu(lieu) {
  if (!lieu || lieu === 'Distanciel') return null

  const key = norm(lieu)

  const cityCode = CITY_TO_CODE[key]
  if (cityCode) {
    const pay = PAYS.find((p) => p.code === cityCode)
    return { code: cityCode, label: pay?.name ?? lieu }
  }

  const aliasCode = ALIAS_TO_CODE[key]
  if (aliasCode) {
    const pay = PAYS.find((p) => p.code === aliasCode)
    return { code: aliasCode, label: pay?.name ?? lieu }
  }

  const direct = PAYS_BY_NORM[key]
  if (direct) return { code: direct.code, label: direct.name }

  const partial = PAYS.find((p) => {
    const n = norm(p.name)
    return key.includes(n) || n.includes(key)
  })
  if (partial) return { code: partial.code, label: partial.name }

  return null
}

export function flagCdnUrl(code, width = 40) {
  return `https://flagcdn.com/w${width}/${code}.png`
}
