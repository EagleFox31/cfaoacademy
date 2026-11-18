/**
 * Drapeau d'un pays (code ISO 3166-1 alpha-2), hébergé avec le portail
 * (paquet `flag-icons`, SVG 4:3) : aucune dépendance à un CDN externe, qui
 * retardait l'affichage sur un réseau lent. Un SVG tient toutes les tailles.
 */
export function drapeauUrl(code) {
  const c = String(code ?? '').trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(c)) return null
  return new URL(`../../node_modules/flag-icons/flags/4x3/${c}.svg`, import.meta.url).href
}
