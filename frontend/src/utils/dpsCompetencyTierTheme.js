/**
 * Norme visuelle — paliers compétence MEDACAP (Equipment).
 * @see docs/dps-competency-tier-visual.md
 */

export const DPS_COMPETENCY_TIERS = ['junior', 'senior', 'expert']

/** Clés i18n portail (`portal.js` → cert_level_*). */
export const DPS_COMPETENCY_TIER_LABEL_KEY = {
  junior: 'cert_level_maintenance',
  senior: 'cert_level_repair',
  expert: 'cert_level_diagnostic',
}

/** Couleur unique par palier — bordure carte, puce, initiales. */
export const DPS_COMPETENCY_TIER_COLOR = {
  junior: '#1a56db',
  senior: '#e67e00',
  expert: '#1aab5b',
}

/**
 * Bande gauche cartes techniciens — alignée sur les tableaux fiche marque
 * (`.portal-dps-tier-table-wrap--*` border / en-têtes).
 */
export const DPS_COMPETENCY_TIER_TABLE_BAND_COLOR = {
  junior: '#93c5fd',
  senior: '#c4b5fd',
  expert: '#fde047',
}

export function normalizeDpsCompetencyTier(tier) {
  if (tier === 'senior' || tier === 'expert') return tier
  return 'junior'
}

export function dpsCompetencyTierAccent(tier) {
  return DPS_COMPETENCY_TIER_COLOR[normalizeDpsCompetencyTier(tier)]
}

export function dpsCompetencyTierTableBandAccent(tier) {
  return DPS_COMPETENCY_TIER_TABLE_BAND_COLOR[normalizeDpsCompetencyTier(tier)]
}

export function dpsCompetencyTierChipClass(tier) {
  return `portal-tier-${normalizeDpsCompetencyTier(tier)}`
}

export function dpsCompetencyTierAvatarVariant(tier) {
  return `tier-${normalizeDpsCompetencyTier(tier)}`
}

export function resolveDpsCompetencyTierLabel(tier, t) {
  const key = DPS_COMPETENCY_TIER_LABEL_KEY[normalizeDpsCompetencyTier(tier)]
  return key && t?.[key] ? t[key] : ''
}
