import { DPS_RESULT_TIER_ALL } from './dpsMetrics.js'

export {
  DPS_COMPETENCY_TIER_LABEL_KEY as DPS_TECH_TIER_LABEL_KEY,
  dpsCompetencyTierAccent,
  dpsCompetencyTierTableBandAccent,
  dpsCompetencyTierAvatarVariant,
  dpsCompetencyTierChipClass,
  resolveDpsCompetencyTierLabel,
} from './dpsCompetencyTierTheme.js'

export function resolveDpsTechnicians(lms) {
  if (Array.isArray(lms?.technicians)) return lms.technicians
  return []
}

export function filterDpsTechniciansByTier(technicians, tierScope = DPS_RESULT_TIER_ALL) {
  if (!technicians?.length) return []
  if (tierScope === DPS_RESULT_TIER_ALL) return technicians
  return technicians.filter(row => row.primaryTier === tierScope)
}

export function countDpsTechniciansByTier(technicians) {
  const counts = { all: technicians?.length ?? 0, junior: 0, senior: 0, expert: 0 }
  for (const row of technicians ?? []) {
    if (counts[row.primaryTier] != null) counts[row.primaryTier] += 1
  }
  return counts
}
