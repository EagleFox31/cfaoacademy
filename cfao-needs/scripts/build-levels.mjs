/**
 * Régénère `api/referential/data/levels_by_code.json`.
 *
 * Source : `frontend/src/data/training-catalog.json`, groupé par marque puis
 * par `level` (G4/G3…, BRONZE/SILVER/GOLD, JUNIOR/SENIOR/EXPERT…).
 *
 * Les codes du fichier 2027 ne collent pas toujours à la vitrine
 * (`SS01-BRONZE` vs `SS01`) : on indexe aussi le code « fiche » sans suffixe
 * de certification, et on conserve les saisies manuelles d'un passage à l'autre.
 *
 * Usage : node cfao-needs/scripts/build-levels.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/^\uFEFF/, '')
const TARGET = new URL('cfao-needs/api/referential/data/levels_by_code.json', ROOT)

const SKIP = /^(Autre|Pi[eè]ces|BASIC \(CFAO\))$/i
const SUZUKI_SUFFIX = /^(.+)-(BRONZE|SILVER|GOLD)$/i
const TOYOTA_G = /^(.+)-(G[1-4])$/i

const norm = (code) =>
  String(code).toUpperCase().replace(/[\s&_]/g, '').replace(/-+/g, '-').trim()

/** Même idée que `ficheFileCode` côté vitrine : retire le suffixe planning. */
function ficheCode(code) {
  let c = norm(code)
  const suzuki = c.match(SUZUKI_SUFFIX)
  if (suzuki) return suzuki[1]
  return c
}

function formatLevel(level) {
  const raw = String(level).trim()
  if (/^JUNIOR$/i.test(raw)) return 'Junior'
  if (/^SENIOR$/i.test(raw)) return 'Senior'
  if (/^EXPERT$/i.test(raw)) return 'Expert'
  if (/^BRONZE$/i.test(raw)) return 'Bronze'
  if (/^SILVER$/i.test(raw)) return 'Silver'
  if (/^GOLD$/i.test(raw)) return 'Gold'
  if (/^BASIC \(MERCEDES\)$/i.test(raw)) return 'BASIC'
  if (/^Induction Level (\d+)$/i.test(raw)) return raw.replace(/^Induction Level /i, 'Induction ')
  if (/^Junior$/i.test(raw)) return 'Junior'
  return raw
}

const vitrine = JSON.parse(read('frontend/src/data/training-catalog.json'))
const catalog2027 = JSON.parse(read('cfao-needs/api/referential/data/catalog_2027.json'))

const byCode = new Map()

function walk(node) {
  if (Array.isArray(node)) {
    // Tableau de groupes { level, trainings } OU liste plate de formations.
    for (const item of node) {
      if (item?.level && Array.isArray(item.trainings)) {
        if (SKIP.test(item.level)) continue
        const label = formatLevel(item.level)
        for (const training of item.trainings) {
          if (!training?.code) continue
          const key = norm(training.code)
          byCode.set(key, label)
          // SS01 sous BRONZE doit aussi répondre à SS01-BRONZE du fichier 2027.
          const cert = label.toUpperCase()
          if (['BRONZE', 'SILVER', 'GOLD'].includes(cert)) {
            byCode.set(norm(`${training.code}-${cert}`), label)
          }
        }
      } else {
        walk(item)
      }
    }
    return
  }
  if (!node || typeof node !== 'object') return
  Object.values(node).forEach(walk)
}
walk(vitrine)

let previous = {}
try {
  previous = JSON.parse(read('cfao-needs/api/referential/data/levels_by_code.json')).levels ?? {}
} catch {
  /* premier passage */
}

/**
 * Suffixe porté par le code lui-même : filet de sécurité quand la vitrine
 * n'a pas la variante (SS05-SILVER, TS04-G3…).
 */
function fromCodeSuffix(code) {
  const key = norm(code)
  const suzuki = key.match(SUZUKI_SUFFIX)
  if (suzuki) return formatLevel(suzuki[2])
  const toyota = key.match(TOYOTA_G)
  if (toyota) return toyota[2]
  return ''
}

const levels = { ...previous }
let fromVitrine = 0
let fromSuffix = 0
const missing = []

for (const row of catalog2027) {
  const key = norm(row.code)
  if (!key || key === '-') continue
  if (levels[key]) continue

  const found =
    byCode.get(key) ||
    byCode.get(ficheCode(row.code)) ||
    fromCodeSuffix(row.code)

  if (found) {
    levels[key] = found
    if (byCode.has(key) || byCode.has(ficheCode(row.code))) fromVitrine += 1
    else fromSuffix += 1
  } else if (row.audience && /^(JUNIOR|SENIOR|EXPERT)$/i.test(row.audience)) {
    levels[key] = formatLevel(row.audience)
    fromSuffix += 1
  } else {
    missing.push(`${row.code} · ${row.brand || '—'} · ${row.title}`)
  }
}

const ordered = Object.fromEntries(
  Object.keys(levels)
    .sort()
    .map((k) => [k, levels[k]]),
)

writeFileSync(
  TARGET,
  `${JSON.stringify(
    {
      _source:
        'Généré par cfao-needs/scripts/build-levels.mjs depuis ' +
        'frontend/src/data/training-catalog.json. Les saisies manuelles sont conservées.',
      _keys:
        'Codes normalisés (majuscules, sans espace ni « & »). Libellé = nomenclature ' +
        'constructeur (G4, Bronze, Junior…), pas le seul palier MEDACAP.',
      levels: ordered,
    },
    null,
    2,
  )}\n`,
  'utf8',
)

const uniqueMissing = [...new Set(missing)]
console.log(`${Object.keys(ordered).length} codes → niveau`)
console.log(`  vitrine / fiche : ${fromVitrine}`)
console.log(`  suffixe / audience : ${fromSuffix}`)
console.log(`${uniqueMissing.length} sans niveau constructeur :`)
uniqueMissing.slice(0, 30).forEach((m) => console.log(`  ${m}`))
