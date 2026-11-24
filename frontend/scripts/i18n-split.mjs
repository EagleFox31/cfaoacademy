/**
 * Découpe les catalogues i18n hérités en un fichier JSON par langue.
 *
 *   source : src/i18n/<module>.js  qui exporte  FOO_BAR_COPY = { fr: {…}, en: {…}, pt: {…} }
 *   cible  : src/i18n/locales/<langue>/fooBar.json   (namespace = nom lu par getCopy)
 *
 * Usage (dans le conteneur front, depuis frontend/) :
 *   node scripts/i18n-split.mjs           écrit les JSON dont le contenu change, puis vérifie
 *   node scripts/i18n-split.mjs --check   n'écrit rien ; échoue si un JSON manque ou diffère
 *
 * Reproductible : sortie déterministe (ordre des clés de la source, indentation 2,
 * fin de ligne LF). Idempotent : un second passage n'écrit rien.
 * Vérification : chaque JSON relu est comparé à l'objet source, clé par clé
 * (type, valeur, ordre des clés, longueur des tableaux).
 * Un namespace dont une valeur n'est pas sérialisable en JSON (fonction, undefined,
 * nombre non fini, objet non littéral, accesseur) n'est pas découpé : il reste en .js.
 * Un module qui importe déjà des JSON de locales est considéré comme migré et ignoré ;
 * une fois les modules hérités retirés, le script n'a plus de source et ne fait rien.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const I18N_DIR = path.join(ROOT, 'src', 'i18n')
const LOCALES_DIR = path.join(I18N_DIR, 'locales')
const CHECK_ONLY = process.argv.includes('--check')

/** Langues déclarées par index.js (`export const LOCALES = [...]`). */
function readLocales() {
  const source = fs.readFileSync(path.join(I18N_DIR, 'index.js'), 'utf8')
  const match = source.match(/export const LOCALES = \[([^\]]*)\]/)
  if (!match) throw new Error('LOCALES introuvable dans src/i18n/index.js')
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Correspondances `namespace: EXPORT_COPY` encore déclarées à la main dans index.js. */
function readLegacySections() {
  const source = fs.readFileSync(path.join(I18N_DIR, 'index.js'), 'utf8')
  return new Map([...source.matchAll(/^\s+(\w+): (\w+_COPY),$/gm)].map((m) => [m[2], m[1]]))
}

/** FOO_BAR_COPY -> fooBar */
function namespaceOf(exportName) {
  return exportName
    .replace(/_COPY$/, '')
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Chemins des valeurs non sérialisables en JSON sans perte. */
function nonSerializable(value, at, out) {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) return out
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) out.push(`${at} (nombre ${value})`)
    return out
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (!(i in value)) out.push(`${at}[${i}] (trou de tableau)`)
      else nonSerializable(value[i], `${at}[${i}]`, out)
    }
    return out
  }
  if (isPlainObject(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') {
        out.push(`${at} (clé symbole)`)
        continue
      }
      const desc = Object.getOwnPropertyDescriptor(value, key)
      if (!desc.enumerable) out.push(`${at}.${key} (non énumérable)`)
      else if ('get' in desc || 'set' in desc) out.push(`${at}.${key} (accesseur)`)
      else nonSerializable(desc.value, `${at}.${key}`, out)
    }
    return out
  }
  out.push(`${at} (${typeof value === 'object' ? value.constructor?.name ?? 'objet' : typeof value})`)
  return out
}

/** Différences clé par clé entre deux valeurs (type, valeur, ordre des clés). */
function diff(a, b, at, out) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return out.push(`${at} : tableau d'un seul côté`), out
    if (a.length !== b.length) out.push(`${at} : longueur ${a.length} -> ${b.length}`)
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) diff(a[i], b[i], `${at}[${i}]`, out)
    return out
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return out.push(`${at} : objet d'un seul côté`), out
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    for (const k of ka) if (!(k in b)) out.push(`${at}.${k} : absente du JSON`)
    for (const k of kb) if (!(k in a)) out.push(`${at}.${k} : en trop dans le JSON`)
    const common = ka.filter((k) => k in b)
    if (common.join('\u0000') !== kb.filter((k) => k in a).join('\u0000')) out.push(`${at} : ordre des clés différent`)
    for (const k of common) diff(a[k], b[k], `${at}.${k}`, out)
    return out
  }
  if (!Object.is(a, b)) out.push(`${at} : ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
  return out
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function loadLegacyCatalogs(locales) {
  const files = fs
    .readdirSync(I18N_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js' && !f.endsWith('.test.js'))
    .sort()
  const catalogs = []
  for (const file of files) {
    const full = path.join(I18N_DIR, file)
    if (/from '\.\/locales\//.test(fs.readFileSync(full, 'utf8'))) continue
    const mod = await import(pathToFileURL(full).href)
    for (const [exportName, value] of Object.entries(mod)) {
      if (!exportName.endsWith('_COPY') || !isPlainObject(value)) continue
      const keys = Object.keys(value)
      if (keys.length === 0 || !keys.every((k) => locales.includes(k))) continue
      catalogs.push({ file, exportName, namespace: namespaceOf(exportName), value })
    }
  }
  return catalogs
}

async function main() {
  const locales = readLocales()
  const legacySections = readLegacySections()
  const catalogs = await loadLegacyCatalogs(locales)
  const errors = []

  if (catalogs.length === 0) {
    console.log('Aucun catalogue hérité à découper : rien à faire.')
    return
  }

  // Les namespaces déduits du nom d'export doivent être ceux qu'index.js déclare encore.
  for (const { exportName, namespace } of catalogs) {
    const declared = legacySections.get(exportName)
    if (legacySections.size > 0 && declared !== namespace) {
      errors.push(`${exportName} : namespace déduit « ${namespace} », index.js déclare « ${declared ?? 'rien'} »`)
    }
  }
  for (const [exportName] of legacySections) {
    if (!catalogs.some((c) => c.exportName === exportName)) errors.push(`${exportName} déclaré dans index.js mais introuvable`)
  }
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }

  let written = 0
  let removed = 0
  const kept = []
  for (const { file, exportName, namespace, value } of catalogs) {
    const problems = locales.flatMap((loc) => (loc in value ? nonSerializable(value[loc], `${namespace}.${loc}`, []) : []))
    if (problems.length) {
      kept.push(`${namespace} (${file}) reste en .js : ${problems.slice(0, 5).join(', ')}`)
      continue
    }
    for (const loc of locales) {
      const target = path.join(LOCALES_DIR, loc, `${namespace}.json`)
      const exists = fs.existsSync(target)
      if (!(loc in value)) {
        // Langue absente de la source : pas de fichier, getCopy retombe sur la langue par défaut.
        if (exists) {
          if (CHECK_ONLY) errors.push(`${path.relative(ROOT, target)} : fichier en trop (langue absente de ${exportName})`)
          else {
            fs.rmSync(target)
            removed += 1
          }
        }
        continue
      }
      const expected = serialize(value[loc])
      const current = exists ? fs.readFileSync(target, 'utf8') : null
      if (current !== expected) {
        if (CHECK_ONLY) {
          errors.push(`${path.relative(ROOT, target)} : ${exists ? 'diffère de la source' : 'manquant'}`)
          continue
        }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, expected)
        written += 1
      }
      const reread = JSON.parse(fs.readFileSync(target, 'utf8'))
      const differences = diff(value[loc], reread, `${namespace}.${loc}`, [])
      if (differences.length) errors.push(...differences.slice(0, 20))
    }
  }

  for (const line of kept) console.warn(line)
  if (errors.length) {
    console.error(`${errors.length} écart(s) :\n${errors.join('\n')}`)
    process.exit(1)
  }
  const mode = CHECK_ONLY ? 'vérifiés' : `vérifiés, ${written} écrit(s), ${removed} supprimé(s)`
  console.log(`${catalogs.length - kept.length} namespace(s) découpé(s) et ${mode}.`)
}

await main()
