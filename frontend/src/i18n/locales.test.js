/**
 * Chaque clé présente dans une langue doit exister dans les autres, pour chaque
 * namespace de src/i18n/locales/<langue>/<namespace>.json.
 * Les écarts acceptés sont listés et justifiés dans locales.exceptions.js.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, getCopy } from './index.js'
import { FR_FROM_SOURCE_DATA, MISSING_KEYS, MISSING_LOCALE_FILES } from './locales.exceptions.js'

const FILES = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' })

const CATALOGS = {}
for (const [file, messages] of Object.entries(FILES)) {
  const [, locale, namespace] = file.match(/^\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  CATALOGS[namespace] ??= {}
  CATALOGS[namespace][locale] = messages
}
const NAMESPACES = Object.keys(CATALOGS).sort()

/** Chemins des feuilles (objets et tableaux parcourus, index pour les tableaux). */
function leafKeys(value, prefix = '', out = new Set()) {
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0 && prefix) out.add(prefix)
    for (const [key, child] of entries) leafKeys(child, prefix ? `${prefix}.${key}` : key, out)
  } else {
    out.add(prefix)
  }
  return out
}

/** Langues comparées pour un namespace (fr exclu quand il vient des données). */
function comparedLocales(namespace) {
  const absent = MISSING_LOCALE_FILES[namespace] ?? []
  return LOCALES.filter((loc) => !absent.includes(loc))
    .filter((loc) => !(loc === DEFAULT_LOCALE && namespace in FR_FROM_SOURCE_DATA))
}

function missingKeys(namespace) {
  const locales = comparedLocales(namespace)
  const sets = Object.fromEntries(locales.map((loc) => [loc, leafKeys(CATALOGS[namespace][loc] ?? {})]))
  const union = new Set(locales.flatMap((loc) => [...sets[loc]]))
  return Object.fromEntries(locales.map((loc) => [loc, [...union].filter((key) => !sets[loc].has(key)).sort()]))
}

describe('catalogues i18n : mêmes clés dans toutes les langues', () => {
  it('trouve les namespaces', () => {
    expect(NAMESPACES.length).toBeGreaterThan(0)
  })

  for (const namespace of NAMESPACES) {
    it(`${namespace} : un fichier par langue`, () => {
      const absent = LOCALES.filter((loc) => !(loc in CATALOGS[namespace]))
      expect(absent, `fichiers manquants pour ${namespace}`).toEqual(MISSING_LOCALE_FILES[namespace] ?? [])
    })

    it(`${namespace} : aucune clé manquante hors exceptions connues`, () => {
      const missing = missingKeys(namespace)
      const known = MISSING_KEYS[namespace] ?? {}
      const unexpected = {}
      for (const [loc, keys] of Object.entries(missing)) {
        const extra = keys.filter((key) => !(known[loc] ?? []).includes(key))
        if (extra.length) unexpected[loc] = extra
      }
      expect(unexpected, `clés manquantes dans ${namespace} (langue : clés)`).toEqual({})
    })

    it(`${namespace} : aucune exception devenue inutile`, () => {
      const missing = missingKeys(namespace)
      const obsolete = {}
      for (const [loc, keys] of Object.entries(MISSING_KEYS[namespace] ?? {})) {
        const stale = keys.filter((key) => !(missing[loc] ?? []).includes(key))
        if (stale.length) obsolete[loc] = stale
      }
      expect(obsolete, `exceptions à retirer de locales.exceptions.js pour ${namespace}`).toEqual({})
    })
  }

  it('les exceptions ne visent que des namespaces existants', () => {
    const declared = [
      ...Object.keys(FR_FROM_SOURCE_DATA),
      ...Object.keys(MISSING_LOCALE_FILES),
      ...Object.keys(MISSING_KEYS),
    ]
    expect(declared.filter((ns) => !NAMESPACES.includes(ns))).toEqual([])
  })

  it('un catalogue fr « issu des données » reste vide', () => {
    const filled = Object.keys(FR_FROM_SOURCE_DATA).filter(
      (ns) => Object.keys(CATALOGS[ns]?.[DEFAULT_LOCALE] ?? {}).length > 0,
    )
    expect(filled).toEqual([])
  })

  it('getCopy sert chaque namespace et retombe sur fr pour une langue sans fichier', () => {
    for (const namespace of NAMESPACES) {
      for (const loc of LOCALES) {
        expect(getCopy(namespace, loc)).toBe(CATALOGS[namespace][loc] ?? CATALOGS[namespace][DEFAULT_LOCALE])
      }
    }
    expect(getCopy('namespace-inconnu', 'fr')).toEqual({})
  })
})
