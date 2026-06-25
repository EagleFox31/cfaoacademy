import { getCopy } from '../i18n/index.js'
import { COUNTRY_BY_CODE } from '../i18n/countries.js'
import { countryCodeFromName } from './countryFlag.js'
import { flagForSessionLieu } from './sessionLieuFlag.js'

export function localizedCountryName(name, locale = 'fr', code) {
  if (!name || locale === 'fr') return name
  const iso = (code ?? countryCodeFromName(name))?.toLowerCase()
  const byCode = COUNTRY_BY_CODE[locale]
  if (iso && byCode?.[iso]) return byCode[iso]
  return getCopy('countries', locale)[name] ?? name
}

export function localizedSessionLieu(lieu, locale = 'fr') {
  if (!lieu) return lieu
  if (/distanciel/i.test(lieu)) {
    return getCopy('cards', locale).remote ?? lieu
  }
  const flag = flagForSessionLieu(lieu)
  if (flag?.label) {
    return localizedCountryName(flag.label, locale, flag.code)
  }
  return localizedCountryName(lieu, locale, countryCodeFromName(lieu))
}

export function localizedFlagForSessionLieu(lieu, locale = 'fr') {
  const flag = flagForSessionLieu(lieu)
  if (!flag) return null
  return {
    ...flag,
    label: localizedCountryName(flag.label, locale, flag.code),
  }
}
