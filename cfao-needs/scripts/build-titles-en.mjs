/**
 * Régénère `api/referential/data/titles_en.json` — les titres anglais du catalogue.
 *
 * Le fichier de travail métier n'a qu'une colonne d'intitulé, en français. La
 * vitrine, elle, publie déjà ses formations en anglais : plutôt que de faire
 * retraduire ce qui l'est, on rapproche les deux catalogues.
 *
 * **La table est indexée sur l'intitulé français, pas sur le code.** Le code ne
 * suffit pas : `TP01` et `TP02` désignent des formations différentes — et même
 * inversées — selon la famille, et `PART01` a deux libellés. Un index sur le
 * code leur donnerait à tous la même traduction, silencieusement fausse.
 *
 * Résolution, dans cet ordre :
 *   1. intitulé français identique dans `frontend/src/data/training-catalog.json`
 *   2. code formation, mais seulement si ce code ne porte qu'un intitulé
 *      (`englishName` de la vitrine, puis `frontend/src/i18n/sessionTitles.js`)
 *   3. entrée déjà saisie à la main dans la table, conservée telle quelle
 *
 * Usage : node cfao-needs/scripts/build-titles-en.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8').replace(/^\uFEFF/, '')

const TARGET = new URL('cfao-needs/api/referential/data/titles_en.json', ROOT)

/** Doit rester identique à `normalize_title` côté Python. */
const normTitle = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Les codes s'écrivent `TS04 - G3` ou `TS04-G3`, `O&JEV02` ou `OJEV02`. */
const normCode = (code) =>
  String(code).toUpperCase().replace(/[\s&_]/g, '').replace(/-+/g, '-').trim()

const vitrine = JSON.parse(read('frontend/src/data/training-catalog.json'))
const sessionTitles = read('frontend/src/i18n/sessionTitles.js')
const catalog2027 = JSON.parse(read('cfao-needs/api/referential/data/catalog_2027.json'))

// ── sources anglaises ───────────────────────────────────────────────────────
const byFrenchTitle = new Map()
const byCode = new Map()
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk)
  if (!node || typeof node !== 'object') return
  if (node.englishName) {
    if (node.name) byFrenchTitle.set(normTitle(node.name), node.englishName.trim())
    if (node.code) byCode.set(normCode(node.code), node.englishName.trim())
  }
  Object.values(node).forEach(walk)
}
walk(vitrine)

/**
 * `sessionTitles.js` empile fr, en et pt dans un même objet. Sans découper le
 * bloc `en`, le portugais écrase l'anglais code par code — et la table repart
 * avec des titres dans une troisième langue.
 */
const englishBlock = (() => {
  const start = sessionTitles.search(/\ben\s*:\s*\{/)
  if (start === -1) throw new Error('bloc `en` introuvable dans sessionTitles.js')
  const rest = sessionTitles.slice(start)
  const end = rest.search(/\n\s*(fr|pt|es)\s*:\s*\{/)
  return end === -1 ? rest : rest.slice(0, end)
})()

for (const [, code, title] of englishBlock.matchAll(
  /['"]([\w&\-. /]+)['"]\s*:\s*['"]([^'"]+)['"]/g,
)) {
  const key = normCode(code)
  if (!byCode.has(key)) byCode.set(key, title.trim())
}

// ── codes ambigus : plusieurs intitulés sous un même code ───────────────────
const titlesPerCode = new Map()
for (const row of catalog2027) {
  const key = normCode(row.code)
  if (!titlesPerCode.has(key)) titlesPerCode.set(key, new Set())
  titlesPerCode.get(key).add(normTitle(row.title))
}

// ── table existante : les traductions saisies à la main survivent ───────────
let manual = {}
try {
  manual = JSON.parse(read('cfao-needs/api/referential/data/titles_en.json')).titles ?? {}
} catch {
  /* premier passage */
}
const manualByKey = new Map(Object.entries(manual).map(([fr, en]) => [normTitle(fr), en]))

// ── résolution ──────────────────────────────────────────────────────────────
const titles = {}
const missing = []
const seen = new Set()
for (const row of catalog2027) {
  const key = normTitle(row.title)
  if (!key || seen.has(key)) continue
  seen.add(key)

  const codeKey = normCode(row.code)
  const codeIsUnambiguous = titlesPerCode.get(codeKey)?.size === 1
  const found =
    byFrenchTitle.get(key) ??
    (codeIsUnambiguous ? byCode.get(codeKey) : undefined) ??
    manualByKey.get(key)

  if (found) titles[row.title] = found
  else missing.push(`${row.code} — ${row.title}`)
}

const ordered = Object.fromEntries(
  Object.keys(titles)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((k) => [k, titles[k]]),
)

writeFileSync(
  TARGET,
  `${JSON.stringify(
    {
      _source:
        'Généré par cfao-needs/scripts/build-titles-en.mjs depuis ' +
        'frontend/src/data/training-catalog.json et frontend/src/i18n/sessionTitles.js. ' +
        'Les entrées absentes de ces sources sont saisies à la main et conservées à la régénération.',
      _keys:
        "Clé = intitulé français de la formation, PAS le code : TP01 et TP02 désignent " +
        'des formations différentes selon la famille. Le rapprochement ignore casse, ' +
        'accents et ponctuation.',
      titles: ordered,
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`${Object.keys(ordered).length} intitulés traduits`)
console.log(`${missing.length} intitulé(s) sans traduction :`)
missing.forEach((m) => console.log(`  ${m}`))
