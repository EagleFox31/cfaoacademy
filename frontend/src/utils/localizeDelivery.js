/**
 * Localise un libellé multilingue stocké dans les données delivery.
 * Les libellés sont des objets { fr, en, pt } ; pt et en retombent sur fr.
 * @param {string | { fr?: string, en?: string, pt?: string } | undefined} value
 * @param {string} locale
 * @returns {string}
 */
export function pickLocale(value, locale = 'fr') {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value[locale] ?? value.fr ?? value.en ?? ''
}
