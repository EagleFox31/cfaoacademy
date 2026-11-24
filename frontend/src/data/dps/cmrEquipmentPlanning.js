// Extractions MEDACAP (noms de techniciens) : hors depot, presentes seulement
// sur les postes qui les ont generees. Sans elles, les vues restent vides.
const extractions = import.meta.glob('../../../../data/dps/cmr-equipment-*.json', { eager: true, import: 'default' })
const summaryPayload = extractions['../../../../data/dps/cmr-equipment-brand-planning-summary.json'] ?? {}
const pifTechniciansPayload = extractions['../../../../data/dps/cmr-equipment-planned-by-technician.json'] ?? {}

export const CMR_EQUIPMENT_PLANNING_YEAR = String(summaryPayload.meta?.planningYear ?? '2025')

/** @type {Record<string, { total: number, done: number, byYear?: Record<string, { total: number, done: number }> }>} */
export const CMR_EQUIPMENT_BRAND_PLANNING_SUMMARY = summaryPayload.brandPlanningSummary ?? {}

/** @type {Array<{ brand: string, pifProposed: number, pifValidated: number, pifProposed2025?: number, pifValidated2025?: number }>} */
export const CMR_EQUIPMENT_BRAND_PIF_STATS = summaryPayload.brandPifStats ?? []

/** @type {Array<{ id: string, name: string, username: string, agency?: string, assignedBrands: string[], total?: number }>} */
export const CMR_EQUIPMENT_PIF_TECHNICIANS = pifTechniciansPayload.technicians ?? []

/**
 * Repli PIF filiale CMR Equipment (extraction locale), seulement quand
 * dps-pif.php n'a pas répondu : jamais par-dessus le live. Ne touche ni aux
 * marques, ni aux techniciens, ni aux scores de compétences.
 */
export function applyCmrEquipmentPifFallback(lms, extraction = {
  summary: CMR_EQUIPMENT_BRAND_PLANNING_SUMMARY,
  pifStats: CMR_EQUIPMENT_BRAND_PIF_STATS,
  technicians: CMR_EQUIPMENT_PIF_TECHNICIANS,
  meta: summaryPayload.meta ?? null,
}) {
  if (!lms || !Object.keys(extraction.summary ?? {}).length) {
    return lms
  }

  const pifByBrand = Object.fromEntries(
    (extraction.pifStats ?? []).map(row => [row.brand, row]),
  )

  const brandStats = (lms.brandStats ?? []).map(row => {
    const local = pifByBrand[row.brand]
    if (!local) return row
    return {
      ...row,
      pifProposed: local.pifProposed ?? row.pifProposed,
      pifValidated: local.pifValidated2025 ?? local.pifValidated ?? row.pifValidated,
    }
  })

  return {
    ...lms,
    brandStats,
    brandPlanningSummary: extraction.summary,
    brandPifStats: extraction.pifStats?.length ? extraction.pifStats : lms.brandPifStats,
    pifTechnicians: extraction.technicians?.length ? extraction.technicians : lms.pifTechnicians,
    cmrEquipmentPlanningMeta: extraction.meta ?? null,
  }
}
