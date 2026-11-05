/** Paliers affichés sur cartes marque et panneau résumé fiche détail. */
export const DPS_BRAND_RESULT_TIER_ROWS = [
  { key: 'junior', labelKey: 'dps_results_tier_maintenance' },
  { key: 'senior', labelKey: 'dps_results_tier_repair' },
  { key: 'expert', labelKey: 'dps_results_tier_diagnostic' },
]

/** Même paliers MEDACAP, libellés jargon Toyota Motors (G4→G2). */
export const TOYOTA_BRAND_RESULT_TIER_ROWS = [
  { key: 'junior', labelKey: 'ki_results_tier_g4' },
  { key: 'senior', labelKey: 'ki_results_tier_g3' },
  { key: 'expert', labelKey: 'ki_results_tier_g2' },
]

export function resolveBrandResultTierRows(nomenclature = 'medacap') {
  return nomenclature === 'toyota' ? TOYOTA_BRAND_RESULT_TIER_ROWS : DPS_BRAND_RESULT_TIER_ROWS
}

function formatCountLine(count, oneKey, manyKey, t) {
  const template = count <= 1 ? t[oneKey] : t[manyKey]
  return template.replace('{count}', String(count))
}

/** Sous-titre cartes #resultats — « X/Y techniciens évalués sur la marque ». */
export function formatDpsBrandEvaluatedLine(count, t, totalTechnicians) {
  if (totalTechnicians != null && totalTechnicians > 0) {
    const ratio = `${count}/${totalTechnicians}`
    const template = totalTechnicians <= 1
      ? t.dps_results_brand_evaluated_one
      : t.dps_results_brand_evaluated
    return template.replace('{count}', ratio)
  }
  return formatCountLine(
    count,
    'dps_results_brand_evaluated_one',
    'dps_results_brand_evaluated',
    t,
  )
}

/** Sous-titre fiche marque — « X/Y techniciens dédiés… ». */
export function formatDpsBrandDedicatedLine(count, t, totalTechnicians) {
  if (totalTechnicians != null && totalTechnicians > 0) {
    const ratio = `${count}/${totalTechnicians}`
    const template = totalTechnicians <= 1
      ? t.dps_results_brand_dedicated_one
      : t.dps_results_brand_dedicated
    return template.replace('{count}', ratio)
  }
  return formatCountLine(
    count,
    'dps_results_brand_dedicated_one',
    'dps_results_brand_dedicated',
    t,
  )
}

/** Libellé palier fiche détail — « X Techniciens Maintenance ». */
export function formatDpsTierSectionTitle(count, tierLabel, t) {
  return formatCountLine(count, 'dps_tier_section_title_one', 'dps_tier_section_title', t)
    .replace('{tier}', tierLabel)
}
