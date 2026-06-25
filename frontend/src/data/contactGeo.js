import cartography from './academy/pays-cartographie.json'
import { localizedCountryName } from '../utils/localizeGeo.js'
import { countryCodeFromName, flagCdnUrlForCountry } from '../utils/countryFlag.js'

/** Indicatifs téléphoniques — clés = nom pays (source FR, cartographie Academy). */
const DIAL_BY_COUNTRY = {
  Maroc: '+212',
  Mauritanie: '+222',
  Sénégal: '+221',
  Gambie: '+220',
  'Guinée-Bissau': '+245',
  Guinée: '+224',
  'Sierra Leone': '+232',
  Libéria: '+231',
  Mali: '+223',
  'Burkina Faso': '+226',
  "Côte d'Ivoire": '+225',
  Ghana: '+233',
  Togo: '+228',
  Bénin: '+229',
  Niger: '+227',
  Nigeria: '+234',
  Tchad: '+235',
  Cameroun: '+237',
  RCA: '+236',
  'Guinée équatoriale': '+240',
  Gabon: '+241',
  Congo: '+242',
  RDC: '+243',
  Éthiopie: '+251',
  Djibouti: '+253',
  Kenya: '+254',
  Tanzanie: '+255',
  Angola: '+244',
  Zambie: '+260',
  Zimbabwe: '+263',
  Mozambique: '+258',
  Malawi: '+265',
  Madagascar: '+261',
  Maurice: '+230',
  'La Réunion': '+262',
}

const BRANCH_HQ = {
  fr: 'CFAO Academy — Douala (siège)',
  en: 'CFAO Academy — Douala (HQ)',
  pt: 'CFAO Academy — Douala (sede)',
}

const BRANCH_OTHER = {
  fr: 'Autre société / Hors réseau CFAO',
  en: 'Other company / Outside CFAO network',
  pt: 'Outra empresa / Fora da rede CFAO',
}

/** Liste unique des pays CFAO Academy (ordre alphabétique FR). */
export function getContactCountryIds() {
  const names = []
  for (const region of cartography.regions) {
    for (const c of region.countries) {
      names.push(c.name)
    }
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'fr'))
}

export function getDialCodeForCountry(countryId) {
  if (!countryId) return ''
  return DIAL_BY_COUNTRY[countryId] ?? ''
}

/** Libellés pays localisés pour le combobox (valeur stockée = id FR). */
export function getContactCountryOptions(locale = 'fr') {
  return getContactCountryIds().map((id) => ({
    id,
    label: localizedCountryName(id, locale, countryCodeFromName(id)),
    flagUrl: flagCdnUrlForCountry(id, 40),
    flagUrl2x: flagCdnUrlForCountry(id, 80),
  }))
}

export function getContactCountryFlag(countryId) {
  if (!countryId) return null
  const src = flagCdnUrlForCountry(countryId, 40)
  if (!src) return null
  return { src, srcSet: `${flagCdnUrlForCountry(countryId, 80)} 2x` }
}

export function countryLabelFromId(countryId, locale = 'fr') {
  if (!countryId) return ''
  return localizedCountryName(countryId, locale, countryCodeFromName(countryId))
}

export function countryIdFromLabel(label, locale = 'fr') {
  const q = label.trim().toLowerCase()
  if (!q) return ''
  const match = getContactCountryOptions(locale).find(
    (o) => o.label.toLowerCase() === q || o.id.toLowerCase() === q,
  )
  return match?.id ?? ''
}

/** Filiales CFAO dérivées des pays + siège + hors réseau. */
export function getContactBranchOptions(locale = 'fr') {
  const loc = locale === 'en' || locale === 'pt' ? locale : 'fr'
  const branches = getContactCountryIds().map(
    (id) => `CFAO ${localizedCountryName(id, locale, countryCodeFromName(id))}`,
  )
  branches.sort((a, b) => a.localeCompare(b, locale))
  return [BRANCH_HQ[loc], ...branches, BRANCH_OTHER[loc]]
}
