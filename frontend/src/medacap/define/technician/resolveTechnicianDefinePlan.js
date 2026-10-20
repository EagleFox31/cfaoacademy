import { PIF_SCOPE_PLURI } from '../../../utils/learnerPif.js'
import { resolveDpsFilialePifTechnicians } from '../../../utils/dpsFilialePifTechnicians.js'
import { resolveDpsBrandMeasureScore } from '../../../utils/dpsMetrics.js'
import { resolveTeamBrands } from '../../../utils/teamBrands.js'
import { normalizeDpsCompetencyTier } from '../../../utils/dpsCompetencyTierTheme.js'
import { evalScoreAccentColor } from '../../../utils/learnerTests.js'

const DONE_STATUSES = new Set(['fait'])
/** Inscrit / en cours uniquement — « à inscrire » et « à programmer » restent À faire. */
const PROGRESS_STATUSES = new Set(['inscrit', 'en_cours'])
const TODO_STATUSES = new Set(['a_inscrire', 'a_programmer', 'todo'])

const MEDACAP_LEVEL_RANK = { Junior: 1, Senior: 2, Expert: 3 }
const TIER_TO_MEDACAP_LEVEL = { junior: 'Junior', senior: 'Senior', expert: 'Expert' }
const MEDACAP_LEVEL_TO_TIER = { Junior: 'junior', Senior: 'senior', Expert: 'expert' }

export const DEFINE_SCOPE_VALUES = ['pluri', '2026', '2025', '2024']

export const DEFINE_VOLUME_STATUS = {
  ALL: 'all',
  TODO: 'todo',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
}

export const DEFAULT_DEFINE_FILTERS = {
  brand: 'all',
  level: 'all',
  scope: PIF_SCOPE_PLURI,
  volumeStatus: DEFINE_VOLUME_STATUS.ALL,
}

export function findDpsFilialeTechnician(lms, technicianKey) {
  if (!technicianKey) return null
  const needle = String(technicianKey).trim().toLowerCase()
  const rows = resolveDpsFilialePifTechnicians(lms)
  return rows.find(row => (
    String(row.id ?? '').toLowerCase() === needle
    || String(row.username ?? '').toLowerCase() === needle
    || String(row.name ?? '').trim().toLowerCase() === needle
  )) ?? null
}

function resolveTechnicianMedacapLevel(technician) {
  if (technician?.level && MEDACAP_LEVEL_RANK[technician.level]) {
    return technician.level
  }
  return TIER_TO_MEDACAP_LEVEL[normalizeDpsCompetencyTier(technician?.primaryTier)] ?? 'Junior'
}

export function resolveTechnicianDefineLevelOptions(technician) {
  const maxLevel = resolveTechnicianMedacapLevel(technician)
  const maxRank = MEDACAP_LEVEL_RANK[maxLevel] ?? 1
  const options = [{ value: 'all', labelKey: 'medacap_define_filter_level_all' }]

  for (const level of ['Junior', 'Senior', 'Expert']) {
    if ((MEDACAP_LEVEL_RANK[level] ?? 99) <= maxRank) {
      options.push({
        value: level,
        labelKey: `medacap_define_filter_level_${MEDACAP_LEVEL_TO_TIER[level]}`,
      })
    }
  }

  return options
}

const CHART_TIER_LABEL_KEY = {
  Junior: 'dps_role_maintenancier',
  Senior: 'dps_role_reparateur',
  Expert: 'dps_role_diagnostiqueur',
}

/** Boutons palier du graphique — limités au niveau max du technicien. */
export function resolveTechnicianChartLevelToggles(technician) {
  const maxLevel = resolveTechnicianMedacapLevel(technician)
  const maxRank = MEDACAP_LEVEL_RANK[maxLevel] ?? 1
  const toggles = [{ value: 'all', labelKey: 'medacap_define_chart_tier_all' }]

  for (const level of ['Junior', 'Senior', 'Expert']) {
    if ((MEDACAP_LEVEL_RANK[level] ?? 99) <= maxRank) {
      toggles.push({ value: level, labelKey: CHART_TIER_LABEL_KEY[level] })
    }
  }

  return toggles
}

function clampChartLevelFilter(level, technician) {
  if (!level || level === 'all') return 'all'
  const allowed = resolveTechnicianChartLevelToggles(technician).map(row => row.value)
  return allowed.includes(level) ? level : 'all'
}

export function resolveTechnicianDefineScopeOptions() {
  return DEFINE_SCOPE_VALUES.map(value => ({
    value,
    labelKey: value === PIF_SCOPE_PLURI
      ? 'medacap_define_scope_pluri'
      : `medacap_define_scope_${value}`,
  }))
}

function pifCodesForTechnician(tech) {
  if (tech.pifCodes?.length) return tech.pifCodes
  const codes = new Set()
  for (const list of Object.values(tech.codesByBrand ?? {})) {
    for (const code of list ?? []) codes.add(code)
  }
  return [...codes]
}

function orderedBrandIds(tech) {
  if (Array.isArray(tech.brands) && tech.brands.length) return tech.brands
  if (Array.isArray(tech.assignedBrands) && tech.assignedBrands.length) return tech.assignedBrands
  return Object.keys(tech.byBrand ?? {})
}

function codesForBrand(tech, brandId) {
  if (!brandId || brandId === 'all') return pifCodesForTechnician(tech)

  const fromMap = tech.codesByBrand?.[brandId]
  if (Array.isArray(fromMap) && fromMap.length) return fromMap

  const codes = tech.pifCodes ?? []
  const byBrand = tech.byBrand ?? {}
  if (!codes.length || byBrand[brandId] == null) return []

  let offset = 0
  for (const bid of orderedBrandIds(tech)) {
    const count = byBrand[bid] ?? 0
    if (bid === brandId) return codes.slice(offset, offset + count)
    offset += count
  }

  return []
}

function filterCodesForScope(codes, lms, scope) {
  if (!scope || scope === PIF_SCOPE_PLURI) return codes

  const statusMap = lms?.planningStatus ?? {}
  const scoped = codes.filter(code => {
    for (const key of Object.keys(statusMap)) {
      const pipe = key.indexOf('|')
      if (pipe < 0) continue
      const year = key.slice(0, 4)
      const keyCode = key.slice(pipe + 1)
      if (keyCode === code && year === scope) return true
    }
    return false
  })

  return scoped.length ? scoped : codes
}

function resolveMeasureTier(filters, technician) {
  if (filters.level && filters.level !== 'all') {
    return MEDACAP_LEVEL_TO_TIER[filters.level] ?? normalizeDpsCompetencyTier(technician.primaryTier)
  }
  return 'all'
}

function resolveCodeVolumeStatus(lms, code, technician = null) {
  const statusMap = (
    technician?.planningStatus
    && Object.keys(technician.planningStatus).length
  )
    ? technician.planningStatus
    : (lms?.planningStatus ?? {})

  for (const [key, status] of Object.entries(statusMap)) {
    const pipe = key.indexOf('|')
    if (pipe < 0) continue
    const keyCode = key.slice(pipe + 1)
    if (keyCode !== code && keyCode.toUpperCase() !== String(code).toUpperCase()) continue
    if (DONE_STATUSES.has(status)) return DEFINE_VOLUME_STATUS.COMPLETED
    if (PROGRESS_STATUSES.has(status)) return DEFINE_VOLUME_STATUS.IN_PROGRESS
    if (TODO_STATUSES.has(status)) return DEFINE_VOLUME_STATUS.TODO
    return DEFINE_VOLUME_STATUS.TODO
  }

  return DEFINE_VOLUME_STATUS.TODO
}

function countCodesForVolumeStatus(lms, codes, volumeStatus, technician = null) {
  if (!volumeStatus || volumeStatus === DEFINE_VOLUME_STATUS.ALL) return codes.length

  return codes.filter(code => resolveCodeVolumeStatus(lms, code, technician) === volumeStatus).length
}

function countPifProgress(lms, pifCodes, technician = null) {
  let completed = 0
  let inProgress = 0
  let todo = 0

  for (const code of pifCodes) {
    const status = resolveCodeVolumeStatus(lms, code, technician)
    if (status === DEFINE_VOLUME_STATUS.COMPLETED) completed += 1
    else if (status === DEFINE_VOLUME_STATUS.IN_PROGRESS) inProgress += 1
    else todo += 1
  }

  return {
    recommended: pifCodes.length,
    completed,
    inProgress,
    todo,
  }
}

function normalizeFilters(filters = {}, technician = null) {
  const level = filters.level || DEFAULT_DEFINE_FILTERS.level
  return {
    brand: filters.brand || DEFAULT_DEFINE_FILTERS.brand,
    level: technician ? clampChartLevelFilter(level, technician) : level,
    scope: filters.scope || DEFAULT_DEFINE_FILTERS.scope,
    volumeStatus: filters.volumeStatus || DEFAULT_DEFINE_FILTERS.volumeStatus,
  }
}

/**
 * Données dashboard Define technicien — miroir TechnicianDashboardController (pluri).
 */
export function resolveTechnicianDefinePlan(lms, technicianKey, filtersInput) {
  const technician = findDpsFilialeTechnician(lms, technicianKey)
  if (!technician) return null

  const filters = normalizeFilters(filtersInput, technician)
  const tier = resolveMeasureTier(filters, technician)
  const brandItems = resolveTeamBrands(technician.brands ?? [])
  const visibleBrands = filters.brand === 'all'
    ? brandItems
    : brandItems.filter(item => item.id === filters.brand)

  const scopedCodes = filterCodesForScope(
    codesForBrand(technician, filters.brand),
    lms,
    filters.scope,
  )
  const kpis = countPifProgress(lms, scopedCodes, technician)

  function buildBrandRow({ id, label, logo }) {
    const brandCodes = filterCodesForScope(codesForBrand(technician, id), lms, filters.scope)
    const formationCount = filters.volumeStatus === DEFINE_VOLUME_STATUS.ALL
      ? brandCodes.length
      : countCodesForVolumeStatus(lms, brandCodes, filters.volumeStatus, technician)

    const avgScore = resolveDpsBrandMeasureScore(lms, technician.name, id, {
      levelFilter: filters.level,
      maxMedacapLevel: resolveTechnicianMedacapLevel(technician),
    })

    return {
      brandId: id,
      label,
      logo,
      formationCount,
      avgScore,
      accentColor: avgScore != null ? evalScoreAccentColor(avgScore) : null,
    }
  }

  const brandRows = visibleBrands.map(item => buildBrandRow(item))

  const chartSeries = brandRows
    .filter(row => (
      filters.volumeStatus === DEFINE_VOLUME_STATUS.ALL
      || row.formationCount > 0
    ))
    .map(row => ({
      brandId: row.brandId,
      label: row.label,
      measureScore: row.avgScore,
      volume: row.formationCount,
    }))

  const hasMeasureData = brandRows.some(row => row.avgScore != null)

  return {
    technician,
    tier,
    filters,
    kpis,
    brandRows,
    chartSeries,
    hasMeasureData,
    levelOptions: resolveTechnicianDefineLevelOptions(technician),
    chartLevelToggles: resolveTechnicianChartLevelToggles(technician),
    scopeOptions: resolveTechnicianDefineScopeOptions(),
    brandOptions: [
      { value: 'all', labelKey: 'medacap_define_filter_brand_all' },
      ...brandItems.map(({ id, label }) => ({ value: id, label })),
    ],
  }
}
