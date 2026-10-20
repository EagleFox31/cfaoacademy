import { resolveDpsTechnicians } from './dpsTechnicians.js'
import { competencyTierForCertLevel } from './learnerTests.js'
import { normalizeDpsCompetencyTier } from './dpsCompetencyTierTheme.js'

const TIER_RANK = { junior: 0, senior: 1, expert: 2 }

export const DPS_PIF_TIER_KEYS = ['junior', 'senior', 'expert']

function unionTechnicianBrands(tech) {
  if (Array.isArray(tech.brands) && tech.brands.length) return tech.brands
  if (Array.isArray(tech.assignedBrands) && tech.assignedBrands.length) return tech.assignedBrands
  const merged = [
    ...(tech.brandJunior ?? []),
    ...(tech.brandSenior ?? []),
    ...(tech.brandExpert ?? []),
  ].filter(id => id && String(id).trim())
  return [...new Set(merged)]
}

function buildMaxTierFromEvaluations(lms) {
  const map = new Map()
  for (const entry of lms?.collaboratorEvaluations ?? []) {
    if (entry.kind !== 'competency' || !entry.competencyTier) continue
    const key = String(entry.collaboratorName ?? '').trim().toLowerCase()
    if (!key) continue
    const tier = normalizeDpsCompetencyTier(entry.competencyTier)
    const prev = map.get(key)
    if (!prev || TIER_RANK[tier] > TIER_RANK[prev]) map.set(key, tier)
  }
  return map
}

function resolvePrimaryTier(tech, tierByName) {
  if (tech.primaryTier) return normalizeDpsCompetencyTier(tech.primaryTier)

  if (tech.level) {
    const fromLevel = competencyTierForCertLevel(tech.level)
    if (fromLevel) return fromLevel
  }

  const nameKey = String(tech.name ?? '').trim().toLowerCase()
  if (nameKey && tierByName.has(nameKey)) return tierByName.get(nameKey)

  return 'junior'
}

function normalizePifTechnicianRow(tech, tierByName) {
  const brands = unionTechnicianBrands(tech)
  return {
    id: tech.id ?? tech.username ?? tech.name,
    name: tech.name,
    agency: tech.agency ?? null,
    brands,
    pifTotal: tech.pifTotal ?? tech.total ?? null,
    username: tech.username ?? null,
    primaryTier: resolvePrimaryTier(tech, tierByName),
    byBrand: tech.byBrand ?? null,
    codesByBrand: tech.codesByBrand ?? null,
    pifCodes: tech.pifCodes ?? null,
    planningStatus: tech.planningStatus ?? null,
  }
}

function sortByName(rows) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
}

/**
 * Roster PIF filiale — techniciens avec marques assignées.
 * Priorité aux données PIF exportées (liste complète), enrichies par le scope live.
 */
export function resolveDpsFilialePifTechnicians(lms) {
  const tierByName = buildMaxTierFromEvaluations(lms)
  const scopeRows = resolveDpsTechnicians(lms)
  const pifRows = lms?.pifTechnicians ?? []
  const scopeByUsername = Object.fromEntries(
    scopeRows.filter(row => row.username).map(row => [row.username, row]),
  )

  if (pifRows.length) {
    return sortByName(
      pifRows.map(row => normalizePifTechnicianRow({
        ...scopeByUsername[row.username],
        ...row,
      }, tierByName)),
    )
  }

  if (scopeRows.length) {
    return sortByName(scopeRows.map(row => normalizePifTechnicianRow(row, tierByName)))
  }

  return []
}

export function groupDpsFilialePifTechniciansByTier(technicians) {
  const groups = Object.fromEntries(DPS_PIF_TIER_KEYS.map(key => [key, []]))
  for (const tech of technicians ?? []) {
    const tier = normalizeDpsCompetencyTier(tech.primaryTier)
    groups[tier]?.push(tech)
  }
  return DPS_PIF_TIER_KEYS
    .map(key => ({ key, rows: groups[key] ?? [] }))
    .filter(group => group.rows.length > 0)
}
