/**
 * Ordre et libellé des niveaux constructeur — aligné sur la vitrine
 * (`frontend/src/utils/portalCertLevel.js`, `publicBrandParcours.js`).
 *
 * Technique / carrosserie : JUNIOR / SENIOR / EXPERT ou G4, Bronze…
 * Process SAV & Parts : pas de palier — regroupement par **public cible**
 * (Manager, Front office, Back office) via `populations`.
 */

/** Rang croissant : entrée → sommet. Inconnu = en dernier, avant « sans niveau ». */
const LEVEL_RANK = {
  Junior: 10,
  JUNIOR: 10,
  G4: 10,
  Bronze: 10,
  BRONZE: 10,
  BASIC: 10,
  'Induction 1': 10,
  'Induction Level 1': 10,
  Senior: 20,
  SENIOR: 20,
  G3: 20,
  Silver: 20,
  SILVER: 20,
  CERTIFIED: 20,
  Expert: 30,
  EXPERT: 30,
  G2: 30,
  Gold: 30,
  GOLD: 30,
  G1: 40,
}

const POPULATION_ORDER = ['MANAGER', 'FRONT_OFFICE', 'BACK_OFFICE']

export function isProcessFamily(familyKey) {
  return /^(process-sav|process-parts)-/.test(String(familyKey || ''))
}

export function levelRank(label) {
  if (!label) return 900
  return LEVEL_RANK[label] ?? LEVEL_RANK[String(label).toUpperCase()] ?? 500
}

function normalizePopulations(populations) {
  const list = Array.isArray(populations) ? populations : []
  return POPULATION_ORDER.filter((code) => list.includes(code))
}

/**
 * Clé de regroupement d'une ligne de catalogue.
 * Process → populations jointes (`FRONT_OFFICE`, `MANAGER+BACK_OFFICE`…).
 * Autres → niveau constructeur / palier MEDACAP.
 */
export function lineGroupKey(line) {
  if (isProcessFamily(line?.family_key)) {
    const pops = normalizePopulations(line.populations)
    return pops.join('+')
  }
  return line?.level_label || line?.tier || ''
}

/** @deprecated alias — préférer `lineGroupKey`. */
export function lineLevelKey(line) {
  return lineGroupKey(line)
}

export function groupRank(key, { process = false } = {}) {
  if (!process) return levelRank(key)
  if (!key) return 900
  const parts = String(key).split('+').filter(Boolean)
  if (parts.length === 1) {
    const i = POPULATION_ORDER.indexOf(parts[0])
    return i >= 0 ? (i + 1) * 10 : 500
  }
  // Mixtes après les publics simples, ordonnés par 1ʳᵉ population.
  const i = POPULATION_ORDER.indexOf(parts[0])
  return 100 + (i >= 0 ? i * 10 : 50) + parts.length
}

/**
 * Libellé affiché dans le titre de carte.
 * Les paliers génériques passent par i18n ; G4 / Bronze restent tels quels.
 */
export function formatLevelHeading(label, t) {
  if (!label) return t('tier.none')
  const upper = String(label).toUpperCase()
  if (upper === 'JUNIOR') return t('tier.JUNIOR')
  if (upper === 'SENIOR') return t('tier.SENIOR')
  if (upper === 'EXPERT') return t('tier.EXPERT')
  return label
}

/** Libellé public cible (une ou plusieurs populations). */
export function formatAudienceHeading(key, t) {
  if (!key) return t('population.none')
  return String(key)
    .split('+')
    .filter(Boolean)
    .map((code) => t(`population.${code}`))
    .join(' · ')
}

export function formatGroupHeading(key, t, { process = false } = {}) {
  return process ? formatAudienceHeading(key, t) : formatLevelHeading(key, t)
}

export function groupTitleI18nKey(process) {
  return process ? 'grid.audienceTitle' : 'grid.levelTitle'
}
