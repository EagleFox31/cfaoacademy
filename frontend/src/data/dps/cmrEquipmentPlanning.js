import summaryPayload from '../../../../data/dps/cmr-equipment-brand-planning-summary.json'
import pifTechniciansPayload from '../../../../data/dps/cmr-equipment-planned-by-technician.json'

export const CMR_EQUIPMENT_PLANNING_YEAR = String(summaryPayload.meta?.planningYear ?? '2025')

/** @type {Record<string, { total: number, done: number, byYear?: Record<string, { total: number, done: number }> }>} */
export const CMR_EQUIPMENT_BRAND_PLANNING_SUMMARY = summaryPayload.brandPlanningSummary ?? {}

/** @type {Array<{ brand: string, pifProposed: number, pifValidated: number, pifProposed2025?: number, pifValidated2025?: number }>} */
export const CMR_EQUIPMENT_BRAND_PIF_STATS = summaryPayload.brandPifStats ?? []

/** @type {Array<{ id: string, name: string, username: string, agency?: string, assignedBrands: string[], total?: number }>} */
export const CMR_EQUIPMENT_PIF_TECHNICIANS = pifTechniciansPayload.technicians ?? []

/**
 * Injecte le PIF filiale CMR Equipment (Define pluri + 2025 x/y par marque).
 * Priorité aux données locales pour brandPlanningSummary / brandPifStats.
 */
export function mergeCmrEquipmentPlanningSummary(lms, mockLms) {
  if (!lms || !Object.keys(CMR_EQUIPMENT_BRAND_PLANNING_SUMMARY).length) {
    return lms
  }

  const mockByBrand = Object.fromEntries(
    (mockLms?.brandStats ?? []).map(row => [row.brand, row]),
  )

  const pifByBrand = Object.fromEntries(
    CMR_EQUIPMENT_BRAND_PIF_STATS.map(row => [row.brand, row]),
  )

  const brandStats = (lms.brandStats ?? []).map(row => {
    const live = pifByBrand[row.brand]
    if (!live) return row
    return {
      ...row,
      pifProposed: live.pifProposed ?? row.pifProposed,
      pifValidated: live.pifValidated2025 ?? live.pifValidated ?? row.pifValidated,
    }
  })

  const knownBrands = new Set(brandStats.map(row => row.brand))
  for (const live of CMR_EQUIPMENT_BRAND_PIF_STATS) {
    if (knownBrands.has(live.brand)) continue
    const mock = mockByBrand[live.brand]
    brandStats.push({
      ...(mock ?? {}),
      brand: live.brand,
      technicians: mock?.technicians ?? (live.brand === 'lovol' ? 1 : 0),
      avgScore: mock?.avgScore ?? null,
      evaluated: mock?.evaluated ?? 0,
      tiers: mock?.tiers,
      pifProposed: live.pifProposed ?? mock?.pifProposed ?? 0,
      pifValidated: live.pifValidated2025 ?? live.pifValidated ?? mock?.pifValidated ?? 0,
    })
  }

  const brandOrder = CMR_EQUIPMENT_BRAND_PIF_STATS.map(row => row.brand)
  brandStats.sort(
    (a, b) => brandOrder.indexOf(a.brand) - brandOrder.indexOf(b.brand),
  )

  return {
    ...lms,
    brandStats: brandStats.length ? brandStats : lms.brandStats,
    brandPlanningSummary: {
      ...(lms.brandPlanningSummary ?? {}),
      ...CMR_EQUIPMENT_BRAND_PLANNING_SUMMARY,
    },
    brandPifStats: CMR_EQUIPMENT_BRAND_PIF_STATS.length
      ? CMR_EQUIPMENT_BRAND_PIF_STATS
      : lms.brandPifStats,
    filialeBrands: CMR_EQUIPMENT_BRAND_PIF_STATS.map(row => row.brand),
    pifTechnicians: CMR_EQUIPMENT_PIF_TECHNICIANS.length
      ? CMR_EQUIPMENT_PIF_TECHNICIANS
      : lms.pifTechnicians,
    cmrEquipmentPlanningMeta: summaryPayload.meta ?? null,
  }
}
