import { getCopy } from '../i18n/index.js'
import { localizedCountryName } from '../utils/localizeGeo.js'
import { countryCodeFromName } from '../utils/countryFlag.js'
import { resolveProfileFilialeLabel, resolveProfilePays } from '../utils/profileOrg.js'

const FILIALE_FLAGS = {
  "Côte d'Ivoire": '/assets/flags/ivory-coast.svg',
  Maroc: '/assets/flags/morocco.svg',
  Sénégal: '/assets/flags/senegal.svg',
  Cameroun: '/assets/flags/cameroon.svg',
  Ghana: '/assets/flags/ghana.svg',
  Nigeria: '/assets/flags/nigeria.svg',
  Kenya: '/assets/flags/kenya.svg',
  Tanzanie: '/assets/flags/tanzania.svg',
  Angola: '/assets/flags/angola.svg',
  Madagascar: '/assets/flags/madagascar.svg',
  Mozambique: '/assets/flags/mozambique.svg',
  Zambie: '/assets/flags/zambia.svg',
}

function localizedFilialeLabel(label, locale) {
  if (!label || locale === 'fr') return label
  const match = label.match(/^CFAO\s+(MOTORS|EQUIPMENT|MOBILITY)\s+(.+)$/i)
  if (match) {
    const pays = localizedCountryName(match[2], locale, countryCodeFromName(match[2]))
    return `CFAO ${match[1]} ${pays}`
  }
  return getCopy('countries', locale)[label] ?? label
}

/** Drapeau pays + libellé filiale (ex. CFAO EQUIPMENT Cameroun). */
export default function PortalFilialeFlag({ user, locale, pill = false, className = '' }) {
  const pays = resolveProfilePays(user)
  const displayLabel = localizedFilialeLabel(resolveProfileFilialeLabel(user), locale)
  const src = pays ? FILIALE_FLAGS[pays] : null

  if (!displayLabel) return null

  const buPaysMatch = displayLabel.match(/^(CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY))\s+(.+)$/i)

  if (pill) {
    return (
      <span className={`portal-header-filiale-pill${className ? ` ${className}` : ''}`}>
        {src && (
          <span className="portal-header-filiale-pill-flag" aria-hidden="true">
            <img src={src} alt="" className="portal-header-flag" loading="eager" />
          </span>
        )}
        {buPaysMatch ? (
          <>
            <span className="portal-header-filiale-pill-bu">{buPaysMatch[1]}</span>
            <span className="portal-header-filiale-pill-pays">{buPaysMatch[2]}</span>
          </>
        ) : (
          <span className="portal-header-filiale-pill-pays portal-header-filiale-pill-pays--solo">
            {displayLabel}
          </span>
        )}
      </span>
    )
  }

  if (!src) {
    return <span className={`portal-header-filiale${className ? ` ${className}` : ''}`}>{displayLabel}</span>
  }
  return (
    <span className={`portal-header-flag-wrap${className ? ` ${className}` : ''}`}>
      <img
        src={src}
        alt=""
        className="portal-header-flag"
        loading="eager"
      />
      <span className="portal-header-filiale">{displayLabel}</span>
    </span>
  )
}
