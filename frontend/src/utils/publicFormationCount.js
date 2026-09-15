import CATALOG from '../data/training-catalog.json'

const MOTORS_BRAND_KEYS = [
  'TOYOTA',
  'MERCEDES',
  'STELLANTIS',
  'SUZUKI',
  'BYD',
  'MITSUBISHI',
  'OMODA & JAECOO',
]

const EQUIPMENT_BRAND_KEYS = [
  'FUSO',
  'HINO',
  'RENAULT TRUCKS',
  'SINOTRUK',
  'SHACMAN',
  'KING LONG',
  'BT',
  'TOYOTA FORKLIFT',
  'JCB',
  'LOVOL',
]

function countBrandTrainings(brandKeys) {
  return brandKeys.reduce((sum, key) => {
    const groups = CATALOG[key]
    if (!Array.isArray(groups)) return sum
    return sum + groups.reduce((s, group) => s + (group.trainings?.length ?? 0), 0)
  }, 0)
}

function flattenProcessBlock(block) {
  if (!block) return []
  if (Array.isArray(block)) return block
  return Object.values(block).flat()
}

function countProcessParts() {
  return (
    flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_MOTORS?.PROCESS_PARTS).length
    + flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_EQUIPMENT?.PROCESS_PARTS).length
  )
}

function countProcessSav() {
  return (
    flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_MOTORS?.PROCESS_SAV).length
    + flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_EQUIPMENT?.PROCESS_SAV).length
  )
}

function countProcessSavFrontOffice() {
  return flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_MOTORS?.PROCESS_SAV)
    .concat(flattenProcessBlock(CATALOG.PROCESS_SAV_PARTS_EQUIPMENT?.PROCESS_SAV))
    .filter((training) => /front\s*office/i.test(training.public ?? ''))
    .length
}

function collectAllTrainings(obj, out = []) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.code) out.push(item)
      else collectAllTrainings(item, out)
    }
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) collectAllTrainings(value, out)
  }
  return out
}

function countTechnicoCommercialTrainings() {
  return collectAllTrainings(CATALOG)
    .filter((training) => /vente/i.test(training.name ?? ''))
    .length
}

const PUBLIC_FORMATION_COUNTERS = {
  'Techniciens Voitures': () => countBrandTrainings(MOTORS_BRAND_KEYS),
  'Techniciens Poids lourds, Engins, Chariots & Bus': () => countBrandTrainings(EQUIPMENT_BRAND_KEYS),
  Carrossiers: () => countBrandTrainings(['CARROSSERIE']),
  'Manager et conseillers services administratifs, financiers': () => countProcessParts(),
  'Process Parts': () => countProcessParts(),
  Parts: () => countProcessParts(),
  'Technico-commerciaux': () => countTechnicoCommercialTrainings(),
  Commerciaux: () => countProcessSavFrontOffice(),
  'Manager et responsables organisation SAV': () => countProcessSav(),
  'Process SAV': () => countProcessSav(),
  'Process SAV & Parts': () => countProcessSav(),
  Clients: () => 0,
}

const formationCountCache = new Map()

/** Nombre de fiches catalogue pour un public (0 si aucune règle ou vide). */
export function getPublicFormationCount(publicName) {
  if (formationCountCache.has(publicName)) {
    return formationCountCache.get(publicName)
  }
  const counter = PUBLIC_FORMATION_COUNTERS[publicName]
  const count = counter ? counter() : 0
  formationCountCache.set(publicName, count)
  return count
}

/** Kicker carte public : niveau seul, ou « niveau · N formation(s) » si N > 0. */
export function formatPublicCardKicker(niv, publicName) {
  const count = getPublicFormationCount(publicName)
  if (count <= 0) return niv
  const label = count > 1 ? 'formations' : 'formation'
  return `${niv} · ${count} ${label}`
}
