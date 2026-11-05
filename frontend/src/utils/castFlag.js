import { countryCodeFromName, flagCdnUrlForCountry } from './countryFlag.js'

/** Drapeaux locaux (SVG) — complété par flagcdn pour RDC, etc. */
const LOCAL_FLAGS = {
  Cameroun: '/assets/flags/cameroon.svg',
  Sénégal: '/assets/flags/senegal.svg',
  France: '/assets/flags/france.svg',
  'Burkina Faso': '/assets/flags/burkina-faso.svg',
  'Burquina Faso': '/assets/flags/burkina-faso.svg',
  Burkina: '/assets/flags/burkina-faso.svg',
  "Côte d'Ivoire": '/assets/flags/ivory-coast.svg',
  RDC: '/assets/flags/democratic-republic-of-congo.svg',
}

/** @returns {{ src: string, srcSet?: string } | null} */
export function flagForCastLieu(lieu) {
  if (!lieu) return null
  const local = LOCAL_FLAGS[lieu]
  if (local) return { src: local }
  const src = flagCdnUrlForCountry(lieu, 40)
  if (!src) return null
  return { src, srcSet: `${flagCdnUrlForCountry(lieu, 80)} 2x` }
}
