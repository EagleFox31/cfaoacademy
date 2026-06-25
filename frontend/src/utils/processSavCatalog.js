import CATALOG from '../data/training-catalog.json'
import { resolveCardBrandBadge } from './cardBrandBadge.js'

export const MOTORS_SAV_FOLDER = {
  sav: 'process_sav_parts_motors/process_sav',
  parts: 'process_sav_parts_motors/process_parts',
}

export const EQUIPMENT_SAV_FOLDER = {
  sav: 'process_sav_parts_equipment/process_sav',
  parts: 'process_sav_parts_equipment/process_parts',
}

/** Visuels cartes organisation SAV — `assets/img_cards/`. */
export const PROCESS_SAV_CARD_IMG = {
  'process_sav_parts_motors/process_sav': '/assets/img_cards/process_sav_motors.png',
  'process_sav_parts_motors/process_parts': '/assets/img_cards/process_pieces_motors.png',
  'process_sav_parts_equipment/process_sav': '/assets/img_cards/process_sav_equipment.png',
  'process_sav_parts_equipment/process_parts': '/assets/img_cards/process_pieces_equipment.png',
}

export function resolveProcessSavCardImage(folder) {
  return PROCESS_SAV_CARD_IMG[folder] ?? null
}

export function isProcessSavFolder(folder) {
  return Boolean(folder?.includes('process_sav'))
}

export function flattenProcessBrands(sectionObj) {
  return Object.entries(sectionObj).flatMap(([catalogBrand, trainings]) =>
    trainings.map((t) => ({ ...t, catalogBrand })),
  )
}

/** Clé catalogue `training-catalog.json` → libellé marque sessions / badge carte. */
function catalogBrandToMarque(catalogBrand) {
  if (!catalogBrand) return null
  if (
    catalogBrand === 'TOUTES_MARQUES_VL'
    || catalogBrand === 'TOUTES_MARQUES'
    || catalogBrand === 'TOUTES_MARQUES_EQUIPMENT'
  ) {
    return catalogBrand.replace(/_/g, ' ')
  }
  return catalogBrand.replace(/_/g, ' ')
}

/**
 * Logo marque ou libellé « Toutes marques » sur les cartes Process SAV (accueil + catalogue).
 * @returns {{ logo?: string, label?: string }}
 */
export function resolveProcessSavCardBadge({ folder, training } = {}) {
  const catalogBrand = training?.catalogBrand
    ?? (folder?.includes('equipment') ? 'TOUTES_MARQUES_EQUIPMENT' : null)

  const marque = catalogBrandToMarque(catalogBrand)
  const ctx = folder?.includes('equipment')
    ? { tagClass: 'parts-eq', bu: 'Parts & Process Equipment' }
    : { tagClass: 'parts-motors', bu: 'Parts & Process Motors' }

  return resolveCardBrandBadge(marque, ctx)
}

export function getMotorsSavTrainings(tab) {
  const m = CATALOG.PROCESS_SAV_PARTS_MOTORS
  return tab === 'sav'
    ? flattenProcessBrands(m.PROCESS_SAV)
    : flattenProcessBrands(m.PROCESS_PARTS)
}

export function getEquipmentSavTrainings(tab) {
  const e = CATALOG.PROCESS_SAV_PARTS_EQUIPMENT
  const items = tab === 'sav'
    ? e.PROCESS_SAV.TOUTES_MARQUES_EQUIPMENT
    : e.PROCESS_PARTS.TOUTES_MARQUES_EQUIPMENT
  return items.map((t) => ({ ...t, catalogBrand: 'TOUTES_MARQUES_EQUIPMENT' }))
}

export function motorsSavTabCounts() {
  const m = CATALOG.PROCESS_SAV_PARTS_MOTORS
  return {
    sav: flattenProcessBrands(m.PROCESS_SAV).length,
    parts: flattenProcessBrands(m.PROCESS_PARTS).length,
  }
}

export function equipmentSavTabCounts() {
  const e = CATALOG.PROCESS_SAV_PARTS_EQUIPMENT
  return {
    sav: e.PROCESS_SAV.TOUTES_MARQUES_EQUIPMENT.length,
    parts: e.PROCESS_PARTS.TOUTES_MARQUES_EQUIPMENT.length,
  }
}
