/**
 * Formateur affiché sur les fiches catalogue (offres accueil / catalogue).
 * Règle métier — ne pas déduire du planning sessions :
 * - Process SAV Motors → Gérold SADIO (formateur Process dédié, stable)
 * - Process SAV Equipment → formateur marque Equipment (pôle Équipement)
 * - Technique Motors → formateur de la marque (pôle Toyota / Autres marques)
 * - Technique Equipment → formateur marque (pôle Équipement)
 * - Carrosserie → Thierry TAMO YOUDOM
 *
 * Source équipe : data/academy/equipe-poles.json
 */

import { BRAND_FOLDER } from './formationFiche.js'
import EQUIPE from '../data/academy/equipe-poles.json'

const FOLDER_TO_POLE_BRAND = {
  toyota: 'toyota',
  suzuki: 'suzuki',
  byd: 'byd',
  'omoda-jaecco': 'omoda',
  mercedes: 'mercedes-benz',
  mitsubishi: 'mitsubishi',
  stellantis: 'stellantis',
  yamaha: 'yamaha',
}

const POLE_BRAND_FORMATEURS = (() => {
  const index = {}
  for (const pole of EQUIPE.poles) {
    for (const member of pole.members) {
      if (!Array.isArray(member.brands)) continue
      for (const brand of member.brands) {
        if (!index[brand]) index[brand] = []
        if (!index[brand].includes(member.name)) index[brand].push(member.name)
      }
    }
  }
  return index
})()

const STACK_MAX = 3

export const PROCESS_MOTORS_FORMATEUR = 'Gérold SADIO'
export const CARROSSERIE_FORMATEUR = 'Thierry TAMO YOUDOM'

/** Marques catalogue sans formateur affiché (poste vacant). */
const CATALOG_FORMATEUR_VACANT = new Set(['stellantis'])

/** Marques Motors VL — référent Cameroun quand plusieurs pays. */
const MOTORS_BRAND_FORMATEUR = {
  toyota: 'Eugène EBENE',
  suzuki: 'Cédric PAKO',
  byd: 'Cédric PAKO',
  'omoda-jaecco': 'Cédric PAKO',
  omoda: 'Cédric PAKO',
  mercedes: 'Hatem BEN ABID',
  mitsubishi: 'Bomba COULIBALY',
  yamaha: 'Gauthier OUEDRAOGO',
}

/** Marques Equipment — référent Cameroun. */
const EQUIPMENT_BRAND_FORMATEUR = {
  'renault-trucks': 'Lucien GAGNE',
  'renault trucks': 'Lucien GAGNE',
  rt: 'Lucien GAGNE',
  hino: 'Lucien GAGNE',
  fuso: 'Lucien GAGNE',
  bt: 'Idris NKOA',
  'king-long': 'Idris NKOA',
  'king long': 'Idris NKOA',
  sinotruk: 'Idris NKOA',
  shacman: 'Idris NKOA',
  jcb: 'Thierry KOUGHA',
  lovol: 'Thierry KOUGHA',
  'toyota-forklift': 'Thierry KOUGHA',
  'toyota forklift': 'Thierry KOUGHA',
  'toyota material': 'Thierry KOUGHA',
  toyie: 'Thierry KOUGHA',
  'mercedes trucks': 'Lucien GAGNE',
}

const MARQUE_CODE_ALIASES = {
  RT: 'renault trucks',
  TOYIE: 'toyota forklift',
  'MERCEDES TRUCKS': 'mercedes trucks',
  'KING LONG': 'king long',
  'RENAULT TRUCKS': 'renault trucks',
}

function normBrandKey(value) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function lookupEquipmentBrand(key) {
  if (!key) return null
  const n = normBrandKey(key)
  return EQUIPMENT_BRAND_FORMATEUR[n] ?? null
}

const BRAND_NAME_ALIASES = {
  'toyota material': 'TOYOTA FORKLIFT',
  'mercedes-benz': 'MERCEDES',
  'omoda & jaecoo': 'OMODA & JAECCO',
  'omoda & jaecco': 'OMODA & JAECCO',
  yamaha: 'YAMAHA',
}

function findCatalogBrandKey(brandKeyOrName) {
  if (!brandKeyOrName) return null
  const raw = typeof brandKeyOrName === 'object' ? brandKeyOrName.name : brandKeyOrName
  const n = normBrandKey(raw)
  if (BRAND_NAME_ALIASES[n]) return BRAND_NAME_ALIASES[n]
  // Jaecoo / JAECCO — même marque, orthographes catalogue vs affichage
  if (n.includes('omoda') && n.includes('jaec')) return 'OMODA & JAECCO'
  // Mercedes Trucks (Equipment) ≠ Mercedes-Benz (VL)
  if (n.includes('mercedes') && n.includes('truck')) return 'MERCEDES TRUCKS'
  const direct = Object.keys(BRAND_FOLDER).find((k) => normBrandKey(k) === n)
  if (direct) return direct
  const byFolder = Object.entries(BRAND_FOLDER).find(([, folder]) => normBrandKey(folder) === n)
  return byFolder?.[0] ?? null
}

function resolveFormateurFromFolderSlug(folderSlug) {
  if (!folderSlug) return null
  if (CATALOG_FORMATEUR_VACANT.has(normBrandKey(folderSlug))) return null
  return (
    lookupEquipmentBrand(folderSlug)
    ?? MOTORS_BRAND_FORMATEUR[normBrandKey(folderSlug)]
    ?? null
  )
}

/** Formateur référent pour une marque catalogue (`JCB`, `Toyota Material`, `jcb`…). */
export function resolveBrandCatalogFormateur(brandKeyOrName) {
  const key = findCatalogBrandKey(brandKeyOrName)
  if (key && BRAND_FOLDER[key]) {
    const fromFolder = resolveFormateurFromFolderSlug(BRAND_FOLDER[key])
    if (fromFolder) return fromFolder
  }
  const raw = typeof brandKeyOrName === 'object' ? brandKeyOrName.name : brandKeyOrName
  return resolveFormateurFromFolderSlug(raw) ?? lookupEquipmentBrand(raw)
}

export function isEquipmentCatalogBrand(brandKey) {
  const raw = typeof brandKey === 'object' ? brandKey.name : brandKey
  if (lookupEquipmentBrand(raw)) return true
  const key = findCatalogBrandKey(brandKey) ?? brandKey
  const folder = BRAND_FOLDER[key]
  return folder ? Boolean(lookupEquipmentBrand(folder)) : false
}

function sortWithPrimary(names, primary) {
  if (!primary || !names.includes(primary)) return [...names]
  return [primary, ...names.filter((n) => n !== primary)]
}

function poleBrandSlugFromFolder(folderSlug) {
  const n = normBrandKey(folderSlug)
  return FOLDER_TO_POLE_BRAND[n] ?? n
}

function folderSlugFromBrand(brandKeyOrName) {
  const key = findCatalogBrandKey(brandKeyOrName)
  if (key && BRAND_FOLDER[key]) return BRAND_FOLDER[key]
  if (typeof brandKeyOrName === 'string') return brandKeyOrName
  return null
}

/**
 * Groupe formateurs Motors VL (équipe-poles + référent Cameroun).
 * @returns {{ kind: 'single'|'pair'|'many', name?: string, names?: string[], primary?: string, all: string[], stack: string[], extra?: number }|null}
 */
export function resolveMotorsBrandFormateurDisplay(brandKeyOrFolder) {
  const folderSlug = folderSlugFromBrand(brandKeyOrFolder)
  if (!folderSlug || lookupEquipmentBrand(folderSlug)) return null

  const poleBrand = poleBrandSlugFromFolder(folderSlug)
  if (CATALOG_FORMATEUR_VACANT.has(poleBrand)) return null
  const allRaw = POLE_BRAND_FORMATEURS[poleBrand]
  if (!allRaw?.length) return null

  const primary = MOTORS_BRAND_FORMATEUR[normBrandKey(folderSlug)] ?? allRaw[0]
  const all = sortWithPrimary(allRaw, primary)
  const stack = all.slice(0, STACK_MAX)

  if (all.length === 1) {
    return { kind: 'single', name: all[0], all, stack }
  }
  if (all.length === 2) {
    return { kind: 'pair', names: all, primary: all[0], all, stack }
  }
  return { kind: 'many', primary, all, stack, extra: all.length - 1 }
}

/** Affichage formateur(s) pour une marque catalogue (Motors groupe, Equipment simple). */
export function resolveBrandFormateurDisplay(brandKeyOrName) {
  const raw = typeof brandKeyOrName === 'object' ? brandKeyOrName.name : brandKeyOrName
  const equipmentByName = lookupEquipmentBrand(raw)
  const folderSlug = folderSlugFromBrand(brandKeyOrName)

  if (equipmentByName || (folderSlug && lookupEquipmentBrand(folderSlug))) {
    const name = resolveBrandCatalogFormateur(brandKeyOrName) ?? equipmentByName
    return name ? { kind: 'single', name, all: [name], stack: [name] } : null
  }
  return resolveMotorsBrandFormateurDisplay(brandKeyOrName)
}

/** Affichage formateur(s) sur une carte / fiche catalogue. */
export function resolveCatalogFormateurDisplay({ folder, training } = {}) {
  if (!folder || !training) return null

  if (folder === 'carrosserie' || folder.startsWith('process_sav')) {
    const name = resolveCatalogFormateur({ folder, training })
    return name ? { kind: 'single', name, all: [name], stack: [name] } : null
  }

  const motors = resolveMotorsBrandFormateurDisplay(folder.split('/')[0])
  if (motors) return motors

  const name = resolveCatalogFormateur({ folder, training })
  return name ? { kind: 'single', name, all: [name], stack: [name] } : null
}

export function isMotorsCatalogBrand(brandKey) {
  return Boolean(resolveMotorsBrandFormateurDisplay(brandKey))
}

function resolveEquipmentMarqueCode(code) {
  const alias = MARQUE_CODE_ALIASES[code?.trim()?.toUpperCase()]
  if (alias) return lookupEquipmentBrand(alias)
  return lookupEquipmentBrand(code)
}

/**
 * @param {{ folder?: string, training?: object }} ctx
 * @returns {string|null}
 */
export function resolveCatalogFormateur({ folder, training } = {}) {
  if (!folder || !training) return null

  if (folder === 'carrosserie') return CARROSSERIE_FORMATEUR

  if (folder.startsWith('process_sav_parts_motors')) {
    return PROCESS_MOTORS_FORMATEUR
  }

  if (folder.startsWith('process_sav_parts_equipment')) {
    const brandKey = training.catalogBrand
    if (brandKey && brandKey !== 'TOUTES_MARQUES_EQUIPMENT') {
      return lookupEquipmentBrand(brandKey) ?? lookupEquipmentBrand(brandKey.replace(/_/g, ' '))
    }
    const marques = training.marques
    if (Array.isArray(marques) && marques.length === 1) {
      return resolveEquipmentMarqueCode(marques[0])
    }
    return null
  }

  const brandFolder = folder.split('/')[0]
  return resolveFormateurFromFolderSlug(brandFolder)
}

/** Liste structurée pour documentation / debug. */
export function listCatalogFormateurAssignments() {
  return {
    processSavMotors: { formateur: PROCESS_MOTORS_FORMATEUR, scope: 'Tout Process SAV & Parts Motors' },
    processSavEquipment: {
      note: 'Formateur du pôle Équipement selon la marque (ou selon planification en session)',
      byBrand: { ...EQUIPMENT_BRAND_FORMATEUR },
    },
    carrosserie: { formateur: CARROSSERIE_FORMATEUR },
    motorsTechnique: { ...MOTORS_BRAND_FORMATEUR },
    equipmentTechnique: { ...EQUIPMENT_BRAND_FORMATEUR },
  }
}
