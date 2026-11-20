import { resolveProfileFilialeLabel, resolveProfilePays } from '../../utils/profilOrg.js'
import { adresse } from '../../lib/adresse'

const FILIALE_FLAGS = {
  "Côte d'Ivoire": adresse('/assets/flags/ivory-coast.svg'),
  Maroc: adresse('/assets/flags/morocco.svg'),
  Sénégal: adresse('/assets/flags/senegal.svg'),
  Cameroun: adresse('/assets/flags/cameroon.svg'),
  Ghana: adresse('/assets/flags/ghana.svg'),
  Nigeria: adresse('/assets/flags/nigeria.svg'),
  Kenya: adresse('/assets/flags/kenya.svg'),
  Tanzanie: adresse('/assets/flags/tanzania.svg'),
  Angola: adresse('/assets/flags/angola.svg'),
  Madagascar: adresse('/assets/flags/madagascar.svg'),
  Mozambique: adresse('/assets/flags/mozambique.svg'),
  Zambie: adresse('/assets/flags/zambia.svg'),
}

/** Pastille drapeau pays + libellé filiale (ex. CFAO EQUIPMENT Cameroun). */
export default function PortalFilialeFlag({ user, className = '' }) {
  const pays = resolveProfilePays(user)
  const displayLabel = resolveProfileFilialeLabel(user)
  const src = pays ? FILIALE_FLAGS[pays] : null

  if (!displayLabel) return null

  const buPaysMatch = displayLabel.match(/^(CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY))\s+(.+)$/i)

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
