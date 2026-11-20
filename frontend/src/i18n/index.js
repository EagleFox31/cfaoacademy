/**
 * Textes de l'interface : un fichier JSON par langue et par namespace,
 * src/i18n/locales/<langue>/<namespace>.json, lu par getCopy(namespace, langue).
 * Ajouter un namespace = déposer ses fichiers JSON, sans rien déclarer ici.
 * Une langue sans fichier pour un namespace retombe sur DEFAULT_LOCALE.
 */
export const LOCALES = ['fr', 'en', 'pt']
export const DEFAULT_LOCALE = 'fr'

const FILES = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' })

const SECTIONS = {}
for (const [file, messages] of Object.entries(FILES)) {
  const [, locale, section] = file.match(/^\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!LOCALES.includes(locale)) continue
  SECTIONS[section] ??= {}
  SECTIONS[section][locale] = messages
}

export function getCopy(section, locale = DEFAULT_LOCALE) {
  const catalog = SECTIONS[section]
  if (!catalog) return {}
  return catalog[locale] ?? catalog[DEFAULT_LOCALE] ?? {}
}
