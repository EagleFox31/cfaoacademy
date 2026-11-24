/**
 * Règle de lieu — Cameroun.
 *
 * Jusqu'à 6 personnes sur un trimestre → uniquement Academy de Douala (CFR).
 * À partir de 7 → le déclarant **peut** aussi choisir son agence (FILIALE),
 * sans y être forcé. Les autres pays gardent le choix libre dès 1 personne.
 */

export const CMR_AGENCY_MIN = 7 // « plus de 6 »
export const ACADEMY_COUNTRY = 'Cameroun'
export const PLACES = ['CFR', 'FILIALE', 'DISTANCE']

function normalizeCountry(country) {
  return String(country || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function isCameroon(country) {
  return normalizeCountry(country) === 'cameroun'
}

/**
 * Corrige un lieu incohérent.
 * Cameroun ≤6 : toujours CFR. Au-delà : conserve le lieu demandé.
 */
export function resolvePlace(country, headcount, requested = 'CFR') {
  const place = PLACES.includes(requested) ? requested : 'CFR'
  if (!isCameroon(country)) return place
  if (Number(headcount) < CMR_AGENCY_MIN) return 'CFR'
  return place
}

/** Options proposées dans le sélecteur. */
export function placeOptionsFor(country, headcount) {
  if (isCameroon(country) && Number(headcount) < CMR_AGENCY_MIN) return ['CFR']
  return PLACES
}
