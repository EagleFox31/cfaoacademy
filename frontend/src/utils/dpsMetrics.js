export {
  medacapDefinePluriDashboardUrl,
  medacapDefineAnnualDashboardUrl,
  MEDACAP_DEFINE_ANNUAL_PATH,
  MEDACAP_DEFINE_PLURI_PATH,
  resolveMedacapDefineLaunchUrl,
  resolveMedacapDefinePifLaunchUrl,
  resolveMedacapBrandQueryParam,
  isDpsPifAnnualScope,
} from './medacapDefine.js'

/** @deprecated Préférer medacapDefinePluriDashboardUrl() */
export { MEDACAP_DEFINE_PLURI_PATH as MEDACAP_DEFINE_URL } from './medacapDefine.js'

export function pct(n, total) {
  if (!total) return 0
  return Math.min(100, Math.round((n / total) * 100))
}

/** Libellé « technicien / techniciens » selon l'effectif. */
export function dpsTechnicianLabel(count, t) {
  return count <= 1
    ? t.dps_hero_brand_technician_one
    : t.dps_hero_brand_technicians_label
}

/** Ligne effectif agence / marque — « 1 technicien », « 2 techniciens ». */
export function dpsTechnicianHeadcountLine(count, t) {
  return `${count} ${dpsTechnicianLabel(count, t)}`
}

export function resolveDpsBrandAccent(avgScore, pifPct) {
  if (avgScore >= 70 && pifPct >= 70) return '#1aab5b'
  if (avgScore >= 60 || pifPct >= 50) return '#1a56db'
  return 'var(--red)'
}

import {
  competencyTierForCertLevel,
  evalScoreAccentColor,
} from './learnerTests.js'
import { medacapBrandToSlug } from './dpsScope.js'
import { normalizeDpsCompetencyTier } from './dpsCompetencyTierTheme.js'
import { TEAM_BRAND_DEFS } from './teamBrands.js'

const DPS_MEDACAP_LEVEL_RANK = { Junior: 1, Senior: 2, Expert: 3 }
const DPS_MEDACAP_LEVELS = ['Junior', 'Senior', 'Expert']
const DPS_MEDACAP_LEVEL_TO_TIER = { Junior: 'junior', Senior: 'senior', Expert: 'expert' }

/** Bordure carte résultat tests filiale — alignée sur la couleur du score. */
export {
  evalScoreAccentColor as resolveDpsBrandTestAccent,
  competencyTierForCertLevel,
}

/** Filtres résultats DPS — paliers compétence Equipment. */
export const DPS_RESULT_TIER_ALL = 'all'
export const DPS_RESULT_TIER_FILTERS = ['all', 'junior', 'senior', 'expert']
export const DPS_RESULT_TIER_KEYS = ['junior', 'senior', 'expert']

function tierSlice(stat, tierScope) {
  if (!stat) return { evaluated: 0, avgScore: null }
  if (tierScope === DPS_RESULT_TIER_ALL) {
    return {
      evaluated: stat.evaluated ?? 0,
      avgScore: stat.avgScore ?? null,
    }
  }
  const tier = stat.tiers?.[tierScope]
  return {
    evaluated: tier?.evaluated ?? 0,
    avgScore: tier?.avgScore ?? null,
  }
}

/**
 * Score total tableau DPS — uniquement si Factuel et concordance Déclaratif existent.
 * Règle stricte technicien : la compétence atelier est non-compensatoire.
 * On prend le score le plus bas (principe du facteur limitant / maillon faible) : min(theory, practical).
 */
export function dpsTheoryPracticalScore(theory, practical) {
  if (theory == null || practical == null) return null
  return Math.min(theory, practical)
}

function brandsFromCollaboratorEvaluation(entry) {
  if (entry.brands?.length) return entry.brands
  if (entry.brand) return [entry.brand]
  return []
}

/** Évaluation GF par marque (prioritaire sur legacy multi-marques). */
export function isDpsGfBrandEvaluation(entry) {
  if (entry?.scoreSource === 'technicianBrandScores' || entry?.scoreSource === 'gf') return true
  return String(entry?.id ?? '').startsWith('medacap-gf-')
}

/** Score mesure compétence pour une marque à un palier (théorie + pratique terminés). */
export function dpsBrandMeasureScoreForTier(lms, collaboratorName, brandId, tier) {
  const nameKey = String(collaboratorName ?? '').trim().toLowerCase()
  const tierNorm = normalizeDpsCompetencyTier(tier)
  if (!nameKey || !brandId || !tierNorm) return null

  let theory = null
  let practical = null
  let sawGf = false

  for (const entry of lms?.collaboratorEvaluations ?? []) {
    if (entry.kind !== 'competency') continue
    if (String(entry.collaboratorName ?? '').trim().toLowerCase() !== nameKey) continue

    const brands = brandsFromCollaboratorEvaluation(entry)
    if (!brands.includes(brandId)) continue
    if (brands.length > 1 && !isDpsGfBrandEvaluation(entry)) continue
    if (normalizeDpsCompetencyTier(entry.competencyTier) !== tierNorm) continue
    if (entry.status !== 'done' || entry.score == null) continue

    const gf = isDpsGfBrandEvaluation(entry)
    if (sawGf && !gf) continue
    if (gf) sawGf = true

    if (entry.modality === 'theory') theory = entry.score
    else if (entry.modality === 'practical') practical = entry.score
  }

  return dpsTheoryPracticalScore(theory, practical)
}

function averageBrandMeasureTierScores(scores) {
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

/**
 * Score mesure marque — palier unique, ou moyenne des paliers mesurés si levelFilter === 'all'.
 *
 * @param {object} [options]
 * @param {'all'|'Junior'|'Senior'|'Expert'} [options.levelFilter='all']
 * @param {'Junior'|'Senior'|'Expert'} [options.maxMedacapLevel='Expert']
 */
export function resolveDpsBrandMeasureScore(lms, collaboratorName, brandId, options = {}) {
  const { levelFilter = 'all', maxMedacapLevel = 'Expert' } = options
  const maxRank = DPS_MEDACAP_LEVEL_RANK[maxMedacapLevel] ?? 3

  if (levelFilter && levelFilter !== 'all') {
    const tier = DPS_MEDACAP_LEVEL_TO_TIER[levelFilter]
      ?? normalizeDpsCompetencyTier(levelFilter)
    return dpsBrandMeasureScoreForTier(lms, collaboratorName, brandId, tier)
  }

  const tierScores = []
  for (const level of DPS_MEDACAP_LEVELS) {
    if ((DPS_MEDACAP_LEVEL_RANK[level] ?? 99) > maxRank) continue
    const score = dpsBrandMeasureScoreForTier(
      lms,
      collaboratorName,
      brandId,
      DPS_MEDACAP_LEVEL_TO_TIER[level],
    )
    if (score != null) tierScores.push(score)
  }

  return averageBrandMeasureTierScores(tierScores)
}

/** Raison d’absence de score total — messages opérationnels pour le DPS. */
export const DPS_SCORE_PENDING_REASON = {
  FACTUEL_IN_PROGRESS: 'factuel_in_progress',
  DECLARATIVE_TECHNICIAN: 'declarative_technician',
  DECLARATIVE_TECHNICIAN_IN_PROGRESS: 'declarative_technician_in_progress',
  DECLARATIVE_MANAGER: 'declarative_manager',
}

export function resolveDpsScorePendingReason(tierRow = {}) {
  const theory = tierRow.theory ?? null
  const practical = tierRow.practical ?? null
  if (theory != null && practical != null) return null

  const stage = tierRow.declarativeStage

  if (stage === 'awaiting_manager') {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_MANAGER
  }
  if (stage === 'technician_in_progress') {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN_IN_PROGRESS
  }

  if (tierRow.theoryInProgress) {
    return DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS
  }

  if (theory != null && practical == null) {
    return DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN
  }

  if (theory == null && practical == null && tierRow.inProgress) {
    return DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS
  }

  if (practical != null && theory == null) {
    return DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS
  }

  return null
}

export function resolveDpsScorePendingLabel(reason, t) {
  switch (reason) {
    case DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS:
      return t.dps_results_pending_factuel_in_progress
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN:
      return t.dps_results_pending_declarative_technician
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN_IN_PROGRESS:
      return t.dps_results_pending_declarative_technician_in_progress
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_MANAGER:
      return t.dps_results_pending_declarative_manager
    default:
      return t.dps_results_tech_in_progress
  }
}

export function resolveDpsScorePendingClass(reason) {
  switch (reason) {
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_MANAGER:
      return 'portal-dps-tier-table-score--pending-manager'
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN:
    case DPS_SCORE_PENDING_REASON.DECLARATIVE_TECHNICIAN_IN_PROGRESS:
      return 'portal-dps-tier-table-score--pending-declarative'
    case DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS:
      return 'portal-dps-tier-table-score--pending-factuel'
    default:
      return 'portal-dps-tier-table-score--in-progress'
  }
}

/** Découpe un nom collaborateur MEDACAP — dernier token = nom, reste = prénom(s). */
export function splitCollaboratorName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '—', lastName: '—' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

/** Mongo `users.level` / palier → slug portail (`junior` | `senior` | `expert`). */
export function normalizeMedacapCompetencyTierSlug(raw) {
  if (raw == null || raw === '') return null
  return competencyTierForCertLevel(raw)
}

function normalizeMedacapBrandSlugList(list) {
  return (list ?? [])
    .map(entry => medacapBrandToSlug(entry))
    .filter(Boolean)
}

/**
 * Niveau max du technicien sur une marque — palier le plus élevé où la marque apparaît
 * dans brandExpert / brandSenior / brandJunior (pas le users.level global).
 */
export function resolveBrandMaxTierForTechnician(tech, brandId) {
  if (!tech || !brandId) return null

  const brandSlug = String(brandId).trim().toLowerCase()
  const expert = normalizeMedacapBrandSlugList(tech.brandExpert)
  const senior = normalizeMedacapBrandSlugList(tech.brandSenior)
  const junior = normalizeMedacapBrandSlugList(tech.brandJunior)

  if (expert.includes(brandSlug)) return 'expert'
  if (senior.includes(brandSlug)) return 'senior'
  if (junior.includes(brandSlug)) return 'junior'
  return null
}

/** Index roster DPS — fiche technicien complète (brandJunior / brandSenior / brandExpert). */
export function buildDpsTechnicianRosterLookup(technicians) {
  const byName = new Map()
  const byId = new Map()

  for (const tech of technicians ?? []) {
    const name = String(tech.name ?? '').trim().toLowerCase()
    if (name) byName.set(name, tech)

    for (const key of [tech.id, tech.username, tech.medacapUsername]) {
      if (key != null && key !== '') {
        byId.set(String(key).toLowerCase(), tech)
      }
    }
  }

  return { byName, byId }
}

/** @deprecated Préférer buildDpsTechnicianRosterLookup + resolveBrandMaxTierForTechnician */
export function buildDpsTechnicianLevelLookup(technicians) {
  return buildDpsTechnicianRosterLookup(technicians)
}

/** @deprecated Préférer buildDpsTechnicianRosterLookup */
export function buildDpsPrimaryTierByName(technicians) {
  return buildDpsTechnicianRosterLookup(technicians).byName
}

const DPS_TIER_RANK = Object.fromEntries(
  DPS_RESULT_TIER_KEYS.map((key, index) => [key, index]),
)

function resolveTechnicianFromRoster(person, collaboratorKey, rosterLookup) {
  if (!rosterLookup) return null

  const nameKey = String(person.name ?? '').trim().toLowerCase()
  if (nameKey && rosterLookup.byName.has(nameKey)) {
    return rosterLookup.byName.get(nameKey)
  }

  for (const key of [collaboratorKey, person.username, person.medacapUsername, person.personId, person.id]) {
    if (key == null || key === '') continue
    const idKey = String(key).toLowerCase()
    if (rosterLookup.byId.has(idKey)) {
      return rosterLookup.byId.get(idKey)
    }
  }

  return null
}

function resolveBrandMaxTierFromEvaluations(collaboratorName, brandId, evaluations) {
  const needle = String(collaboratorName ?? '').trim().toLowerCase()
  const brandSlug = String(brandId ?? '').trim().toLowerCase()
  if (!needle || !brandSlug) return null

  let maxTier = null
  let maxRank = -1

  for (const e of evaluations ?? []) {
    if (e.kind !== 'competency') continue
    if (String(e.collaboratorName ?? '').trim().toLowerCase() !== needle) continue

    const brands = e.brands?.length ? e.brands : (e.brand ? [e.brand] : [])
    if (!brands.some(b => String(b).trim().toLowerCase() === brandSlug)) continue

    const tier = normalizeMedacapCompetencyTierSlug(e.competencyTier) ?? e.competencyTier
    const rank = DPS_TIER_RANK[tier] ?? -1
    if (rank > maxRank) {
      maxRank = rank
      maxTier = tier
    }
  }

  return maxTier
}

/**
 * Palier marque technicien — résout le niveau net par marque (brandLevel / certLevels[brandId])
 * ou le palier global (users.level / primaryTier) MEDACAP.
 * Chaque technicien a UN niveau par marque et n'apparaît que dans ce palier.
 */
export function resolveTechnicianBrandLevel(person, collaboratorKey, brandId, rosterLookup) {
  const tech = resolveTechnicianFromRoster(person, collaboratorKey, rosterLookup)
  const brandSlug = String(brandId ?? '').trim().toLowerCase()

  if (brandSlug) {
    const brandTier = tech?.brandLevels?.[brandSlug]
      ?? tech?.certLevels?.[brandSlug]
      ?? tech?.brandTiers?.[brandSlug]
      ?? tech?.brands?.[brandSlug]
      ?? person?.brandLevels?.[brandSlug]
      ?? person?.certLevels?.[brandSlug]
      ?? person?.brandTiers?.[brandSlug]
      ?? person?.brandLevel
      ?? tech?.brandLevel
    if (brandTier) {
      const normalized = normalizeMedacapCompetencyTierSlug(brandTier) || competencyTierForCertLevel(brandTier)
      if (normalized) return normalized
    }
  }

  return resolveTechnicianGlobalLevel(person, collaboratorKey, rosterLookup)
}

/**
 * Palier global technicien — `users.level` / `primaryTier` MEDACAP.
 * Utilisé pour le tableau fiche marque (pas brandJunior / brandSenior / brandExpert).
 */
export function resolveTechnicianGlobalLevel(person, collaboratorKey, rosterLookup) {
  const tech = resolveTechnicianFromRoster(person, collaboratorKey, rosterLookup)

  if (tech?.primaryTier) {
    return normalizeMedacapCompetencyTierSlug(tech.primaryTier) ?? 'junior'
  }

  if (tech?.level) {
    const fromLevel = competencyTierForCertLevel(tech.level)
    if (fromLevel) return fromLevel
  }

  if (person?.medacapLevel) {
    const fromPerson = normalizeMedacapCompetencyTierSlug(person.medacapLevel)
    if (fromPerson) return fromPerson
  }

  return 'junior'
}

/**
 * @deprecated Préférer resolveTechnicianBrandLevel / resolveTechnicianGlobalLevel
 */
export function resolveTechnicianRoleTier(person, collaboratorKey, brandId, rosterLookup, evaluations) {
  void evaluations
  return resolveTechnicianBrandLevel(person, collaboratorKey, brandId, rosterLookup)
}

/** Rang poste dans un tableau palier (utilitaire legacy / tests). */
export function roleTierSortOrderInTable(roleTier, tableTierKey) {
  const roleRank = DPS_TIER_RANK[normalizeMedacapCompetencyTierSlug(roleTier) ?? roleTier] ?? 99
  const tableRank = DPS_TIER_RANK[tableTierKey] ?? 0
  if (roleRank < tableRank) return 100 + roleRank
  return roleRank - tableRank
}

function compareTechnicianTableRows(a, b) {
  return a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' })
    || a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' })
}

function enrichCollaboratorsGlobalLevel(collaborators, rosterLookup, brandId) {
  for (const [key, person] of Object.entries(collaborators ?? {})) {
    person.roleTierForBrand = resolveTechnicianBrandLevel(person, key, brandId, rosterLookup)
  }
}

function technicianTableRowForTier(id, person, tierKey, rosterLookup, brandId) {
  const slot = buildTechnicianTierSlot(person[tierKey] ?? {})
  if (!slot) return null

  const roleTier = resolveTechnicianBrandLevel(person, id, brandId, rosterLookup)
  const { firstName, lastName } = splitCollaboratorName(person.name)
  return {
    id: `${id}::${tierKey}`,
    personId: id,
    name: person.name,
    firstName,
    lastName,
    agency: person.agency ?? null,
    tierKey,
    roleTier,
    theory: slot.theory,
    practical: slot.practical,
    theoryInProgress: slot.theoryInProgress,
    practicalInProgress: slot.practicalInProgress,
    declarativeStage: slot.declarativeStage,
    scoreTotal: dpsTheoryPracticalScore(slot.theory, slot.practical),
    inProgress: slot.inProgress,
    pendingReason: slot.pendingReason,
  }
}

/** Techniciens par palier — un seul tableau selon users.level / brandLevel ; note = scores à ce palier sur la marque. */
export function groupTechniciansByTier(collaborators, brandId, rosterLookup, evaluations) {
  void evaluations

  const groups = Object.fromEntries(
    DPS_RESULT_TIER_KEYS.map(key => [key, []]),
  )

  for (const [id, person] of Object.entries(collaborators ?? {})) {
    const levelTier = resolveTechnicianBrandLevel(person, id, brandId, rosterLookup)
    const row = technicianTableRowForTier(id, person, levelTier, rosterLookup, brandId)
    if (row) {
      groups[levelTier].push(row)
    }
  }

  for (const key of DPS_RESULT_TIER_KEYS) {
    groups[key].sort(compareTechnicianTableRows)
  }

  return groups
}

/** Moyenne des scores d’un tableau palier (techniciens avec note). */
export function avgScoreFromTierTableRows(rows, key = 'scoreTotal') {
  const scores = (rows ?? []).map(row => row[key]).filter(score => score != null)
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

/** Effectif et moyennes dérivés des tableaux affichés (source unique pour la fiche marque). */
export function summarizeBrandDetailTechnicians(techniciansByTier) {
  let total = 0
  const allScores = []
  const tiers = {}

  for (const tierKey of DPS_RESULT_TIER_KEYS) {
    const rows = techniciansByTier?.[tierKey] ?? []
    total += rows.length
    const avgScore = avgScoreFromTierTableRows(rows)
    if (rows.length > 0) {
      tiers[tierKey] = { count: rows.length, avgScore }
    }
    for (const row of rows) {
      if (row.scoreTotal != null) allScores.push(row.scoreTotal)
    }
  }

  const tierScores = Object.values(tiers)
    .map(t => t.avgScore)
    .filter(score => score != null)

  const avgScore = tierScores.length
    ? Math.round(tierScores.reduce((sum, score) => sum + score, 0) / tierScores.length)
    : (allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : null)

  return {
    total,
    evaluated: allScores.length,
    avgScore,
    tiers,
  }
}

export function countBrandDetailTechnicians(techniciansByTier) {
  return summarizeBrandDetailTechnicians(techniciansByTier).total
}

function competencyModalityKey(e) {
  if (e.modality === 'practical') return 'practical'
  return 'theory'
}

function mergeCompetencyEvalIntoTierRow(row, e, modality) {
  if (e.status === 'done' && e.score != null) {
    row[modality] = e.score
    return
  }

  if (modality === 'theory' && e.status === 'progress') {
    row.theoryInProgress = true
    row.inProgress = true
    return
  }

  if (modality !== 'practical') return

  if (e.status === 'progress') {
    row.inProgress = true
    row.practicalInProgress = true
  }
  if (e.declarativeStage) {
    row.declarativeStage = e.declarativeStage
    if (e.declarativeStage !== 'awaiting_technician' || e.status !== 'todo') {
      row.inProgress = true
      row.practicalInProgress = true
    }
  }
}

/** Moyenne marque = moyenne des moyennes technicien. */
function dpsBrandAverageFromPersonScores(personScores) {
  if (!personScores.length) return null
  return Math.round(personScores.reduce((sum, n) => sum + n, 0) / personScores.length)
}

function dpsBrandScoresFromCollaborators(collaborators, tierScope) {
  const tiersToScan = tierScope === DPS_RESULT_TIER_ALL
    ? ['junior', 'senior', 'expert']
    : [tierScope]

  if (tierScope !== DPS_RESULT_TIER_ALL) {
    const personScores = []
    let evaluatedCount = 0
    for (const [key, tiers] of Object.entries(collaborators)) {
      const row = tiers[tierScope] ?? {}
      const personAvg = dpsTheoryPracticalScore(row.theory, row.practical)
      if (personAvg != null) personScores.push(personAvg)
      if (personAvg != null || row.inProgress) evaluatedCount++
    }
    return {
      evaluated: evaluatedCount,
      avgScore: dpsBrandAverageFromPersonScores(personScores),
    }
  }

  // Moyenne simple des paliers (Maintenance, Réparation, Diagnostic)
  const tierAvgs = []
  const evaluatedKeys = new Set()
  for (const tier of ['junior', 'senior', 'expert']) {
    const tierPersonScores = []
    for (const [key, tiers] of Object.entries(collaborators)) {
      const row = tiers[tier] ?? {}
      const personAvg = dpsTheoryPracticalScore(row.theory, row.practical)
      if (personAvg != null) {
        tierPersonScores.push(personAvg)
        evaluatedKeys.add(key)
      }
      if (row.inProgress) {
        evaluatedKeys.add(key)
      }
    }
    const tAvg = dpsBrandAverageFromPersonScores(tierPersonScores)
    if (tAvg != null) tierAvgs.push(tAvg)
  }

  return {
    evaluated: evaluatedKeys.size,
    avgScore: tierAvgs.length
      ? Math.round(tierAvgs.reduce((sum, n) => sum + n, 0) / tierAvgs.length)
      : null,
  }
}

function buildBrandCollaboratorTiersMap(evaluations, brandId) {
  /** @type {Record<string, { name: string, agency?: string, junior: object, senior: object, expert: object }>} */
  const collaborators = {}

  for (const e of evaluations ?? []) {
    if (e.kind !== 'competency') continue
    const brands = e.brands?.length ? e.brands : (e.brand ? [e.brand] : [])
    if (!brands.includes(brandId)) continue

    const tier = e.competencyTier ?? 'junior'
    if (!DPS_RESULT_TIER_KEYS.includes(tier)) continue

    const collaboratorKey = e.collaboratorName
      || e.medacap?.userId
      || e.id
      || 'unknown'
    const modality = competencyModalityKey(e)

    if (!collaborators[collaboratorKey]) {
      collaborators[collaboratorKey] = {
        name: e.collaboratorName || collaboratorKey,
        agency: e.agency,
        medacapLevel: e.medacapLevel ?? e.collaboratorLevel ?? e.userLevel ?? null,
        junior: {},
        senior: {},
        expert: {},
      }
    } else {
      if (e.agency && !collaborators[collaboratorKey].agency) {
        collaborators[collaboratorKey].agency = e.agency
      }
      if (!collaborators[collaboratorKey].medacapLevel) {
        collaborators[collaboratorKey].medacapLevel = e.medacapLevel
          ?? e.collaboratorLevel
          ?? e.userLevel
          ?? null
      }
    }

    const row = collaborators[collaboratorKey][tier]
    mergeCompetencyEvalIntoTierRow(row, e, modality)
  }

  return collaborators
}

function buildTechnicianTierSlot(tierRow = {}) {
  const theory = tierRow.theory ?? null
  const practical = tierRow.practical ?? null
  const mastery = dpsTheoryPracticalScore(theory, practical)
  const pendingReason = mastery == null ? resolveDpsScorePendingReason(tierRow) : null
  const inProgress = pendingReason != null
  const hasAnyScore = theory != null || practical != null

  if (!hasAnyScore && !inProgress) return null

  return {
    theory,
    practical,
    mastery,
    inProgress,
    pendingReason,
    theoryInProgress: Boolean(tierRow.theoryInProgress),
    practicalInProgress: Boolean(tierRow.practicalInProgress),
    declarativeStage: tierRow.declarativeStage ?? null,
  }
}

function technicianRowsForTier(collaborators, tierKey) {
  const rows = []

  for (const [id, person] of Object.entries(collaborators)) {
    const slot = buildTechnicianTierSlot(person[tierKey] ?? {})
    if (!slot) continue

    rows.push({
      id,
      name: person.name,
      agency: person.agency ?? null,
      ...slot,
    })
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/** Profils complets — 3 paliers par technicien (Maintenance, Réparation, Diagnostic). */
function technicianProfilesFromCollaborators(collaborators) {
  const rows = []

  for (const [id, person] of Object.entries(collaborators)) {
    const tiers = Object.fromEntries(
      DPS_RESULT_TIER_KEYS.map(tierKey => [
        tierKey,
        buildTechnicianTierSlot(person[tierKey] ?? {}),
      ]),
    )

    const hasAnyTier = DPS_RESULT_TIER_KEYS.some(key => tiers[key] != null)
    if (!hasAnyTier) continue

    const masteryScores = DPS_RESULT_TIER_KEYS
      .map(key => tiers[key]?.mastery)
      .filter(v => v != null)

    rows.push({
      id,
      name: person.name,
      agency: person.agency ?? null,
      tiers,
      mastery: masteryScores.length
        ? Math.round(masteryScores.reduce((sum, n) => sum + n, 0) / masteryScores.length)
        : null,
    })
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Synthèse consolidée « Toutes marques » — tous les techniciens de la filiale par palier.
 */
export function resolveDpsAllBrandsTechnicianResults(lms) {
  const rosterLookup = buildDpsTechnicianRosterLookup(lms?.technicians)
  const evaluations = lms?.collaboratorEvaluations ?? []

  const groups = Object.fromEntries(
    DPS_RESULT_TIER_KEYS.map(key => [key, []]),
  )

  const allTechs = [...(lms?.technicians ?? [])]
  if (!allTechs.length) {
    const seenTechNames = new Set()
    for (const e of evaluations) {
      if (e.kind !== 'competency') continue
      const name = String(e.collaboratorName ?? '').trim()
      if (!name || seenTechNames.has(name.toLowerCase())) continue
      seenTechNames.add(name.toLowerCase())
      allTechs.push({
        id: e.medacap?.userId || name,
        name,
        agency: e.agency || null,
        primaryTier: e.competencyTier || 'junior',
        brands: e.brands || (e.brand ? [e.brand] : []),
      })
    }
  }

  for (const tech of allTechs) {
    const tierKey = resolveTechnicianGlobalLevel(tech, tech.username || tech.id, rosterLookup)
    const { firstName, lastName } = splitCollaboratorName(tech.name)

    const validScores = []
    const theoryScores = []
    const practicalScores = []
    let hasInProgress = false
    let pendingReason = null

    const byBrand = {}
    for (const e of evaluations) {
      if (e.kind !== 'competency') continue
      if (String(e.collaboratorName ?? '').trim().toLowerCase() !== String(tech.name ?? '').trim().toLowerCase()) continue
      if (normalizeDpsCompetencyTier(e.competencyTier) !== tierKey) continue

      const brands = brandsFromCollaboratorEvaluation(e)
      for (const b of brands) {
        if (!byBrand[b]) byBrand[b] = {}
        const mod = competencyModalityKey(e)
        mergeCompetencyEvalIntoTierRow(byBrand[b], e, mod)
      }
    }

    for (const [, row] of Object.entries(byBrand)) {
      const s = dpsTheoryPracticalScore(row.theory, row.practical)
      if (s != null) {
        validScores.push(s)
        if (row.theory != null) theoryScores.push(row.theory)
        if (row.practical != null) practicalScores.push(row.practical)
      } else if (row.inProgress) {
        hasInProgress = true
        if (!pendingReason) pendingReason = row.pendingReason || resolveDpsScorePendingReason(row)
      }
    }

    const hasScore = validScores.length > 0
    const scoreTotal = hasScore ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null
    const theory = theoryScores.length ? Math.round(theoryScores.reduce((a, b) => a + b, 0) / theoryScores.length) : null
    const practical = practicalScores.length ? Math.round(practicalScores.reduce((a, b) => a + b, 0) / practicalScores.length) : null

    const row = {
      id: `${tech.id || tech.username || tech.name}::${tierKey}`,
      personId: tech.id || tech.username || tech.name,
      name: tech.name,
      firstName,
      lastName,
      agency: tech.agency ?? null,
      tierKey,
      roleTier: tierKey,
      theory,
      practical,
      theoryInProgress: false,
      practicalInProgress: false,
      declarativeStage: null,
      scoreTotal,
      inProgress: !hasScore && hasInProgress,
      pendingReason: !hasScore ? (pendingReason || (hasInProgress ? DPS_SCORE_PENDING_REASON.FACTUEL_IN_PROGRESS : null)) : null,
    }

    groups[tierKey].push(row)
  }

  for (const key of DPS_RESULT_TIER_KEYS) {
    groups[key].sort(compareTechnicianTableRows)
  }

  const tableSummary = summarizeBrandDetailTechnicians(groups)
  const totalTechnicians = allTechs.length || tableSummary.total

  const detailTiers = {}
  for (const tierKey of DPS_RESULT_TIER_KEYS) {
    const fromTable = tableSummary.tiers[tierKey]
    if (fromTable && fromTable.count > 0) {
      detailTiers[tierKey] = {
        count: fromTable.count,
        avgScore: fromTable.avgScore,
      }
    }
  }

  const summary = {
    avgScore: tableSummary.avgScore,
    evaluated: tableSummary.evaluated,
    technicians: totalTechnicians,
    tiers: detailTiers,
  }

  const tierProfiles = Object.fromEntries(
    DPS_RESULT_TIER_KEYS.map(tierKey => [
      tierKey,
      { technicians: groups[tierKey] },
    ]),
  )

  return {
    brand: 'toutes-marques',
    label: 'Toutes marques',
    summary,
    cardSummary: summary,
    detailSummary: summary,
    tiers: tierProfiles,
    technicians: allTechs,
    techniciansByTier: groups,
  }
}

/**
 * Détail résultats par marque — techniciens groupés par palier (Maintenance, Réparation, Diagnostic).
 */
export function resolveDpsBrandTechnicianResults(lms, brandId) {
  if (brandId === 'toutes-marques' || brandId === 'all') {
    return resolveDpsAllBrandsTechnicianResults(lms)
  }

  const evaluations = lms?.collaboratorEvaluations
  const collaborators = buildBrandCollaboratorTiersMap(evaluations, brandId)
  const rosterLookup = buildDpsTechnicianRosterLookup(lms?.technicians)
  enrichCollaboratorsGlobalLevel(collaborators, rosterLookup, brandId)

  const tierProfiles = Object.fromEntries(
    DPS_RESULT_TIER_KEYS.map(tierKey => [
      tierKey,
      { technicians: technicianRowsForTier(collaborators, tierKey) },
    ]),
  )

  const statsByBrand = Object.fromEntries((lms?.brandStats ?? []).map(b => [b.brand, b]))
  const statRow = statsByBrand[brandId]

  const summaryRow = resolveDpsBrandTestSummaries(lms, [brandId])[0] ?? {
    brand: brandId,
    avgScore: null,
    evaluated: 0,
    technicians: 0,
    tiers: {},
  }

  const technicians = technicianProfilesFromCollaborators(collaborators)
  const techniciansByTier = groupTechniciansByTier(
    collaborators,
    brandId,
    rosterLookup,
    evaluations,
  )
  const tableSummary = summarizeBrandDetailTechnicians(techniciansByTier)

  // Synthèse macro (brandStats / summaryRow) — source pour les cartes de la filiale
  const macroTiers = {}
  for (const tierKey of DPS_RESULT_TIER_KEYS) {
    const fromStat = summaryRow.tiers?.[tierKey]
    const fromBrandStat = statRow?.tiers?.[tierKey]
    const fromTable = tableSummary.tiers?.[tierKey]
    const avgScore = fromTable?.avgScore ?? fromStat?.avgScore ?? fromBrandStat?.avgScore ?? null
    const count = fromTable?.count ?? fromStat?.evaluated ?? fromBrandStat?.evaluated ?? 0
    if (avgScore != null || count > 0) {
      macroTiers[tierKey] = { count, avgScore }
    }
  }

  const macroTierScores = Object.values(macroTiers)
    .map(t => t.avgScore)
    .filter(s => s != null)
  const macroAvgScore = macroTierScores.length
    ? Math.round(macroTierScores.reduce((sum, s) => sum + s, 0) / macroTierScores.length)
    : (statRow?.avgScore ?? summaryRow.avgScore ?? null)

  const macroSummary = {
    avgScore: tableSummary.avgScore ?? macroAvgScore,
    evaluated: tableSummary.total > 0 ? tableSummary.total : (statRow?.evaluated ?? summaryRow.evaluated),
    technicians: statRow?.technicians ?? summaryRow.technicians ?? tableSummary.total,
    tiers: macroTiers,
  }

  // Synthèse détail (tableSummary) — reflète strictement les techniciens affichés dans les tableaux
  const detailTiers = {}
  for (const tierKey of DPS_RESULT_TIER_KEYS) {
    const fromTable = tableSummary.tiers[tierKey]
    if (fromTable && fromTable.count > 0) {
      detailTiers[tierKey] = {
        count: fromTable.count,
        avgScore: fromTable.avgScore,
      }
    }
  }

  const detailSummary = {
    avgScore: tableSummary.total > 0 ? tableSummary.avgScore : macroSummary.avgScore,
    evaluated: tableSummary.total > 0 ? tableSummary.total : macroSummary.evaluated,
    technicians: macroSummary.technicians ?? (tableSummary.total > 0 ? tableSummary.total : 0),
    tiers: tableSummary.total > 0 ? detailTiers : macroTiers,
  }

  // Cartes d'accueil : reflète les données calculées
  const hasRicherMacro = (macroSummary.evaluated ?? 0) > tableSummary.total && tableSummary.total === 0
  const cardSummary = hasRicherMacro ? macroSummary : detailSummary

  return {
    brand: brandId,
    summary: cardSummary,
    cardSummary,
    detailSummary,
    tiers: tierProfiles,
    technicians,
    techniciansByTier,
  }
}

/**
 * Synthèse cartes portail DPS — extrait le summary de {@link resolveDpsBrandTechnicianResults}.
 * @deprecated Préférer resolveDpsBrandResultsMap ou resolveDpsBrandTechnicianResults directement.
 */
export function resolveDpsBrandDisplaySummaries(lms, brandOrder = []) {
  return resolveDpsBrandResultsMap(lms, brandOrder).map(({ brand, summary }) => ({
    brand,
    ...summary,
  }))
}

/** Résultats par marque indexés par id — source unique cartes + fiche détail. */
export function resolveDpsBrandResultsMap(lms, brandOrder = []) {
  const order = brandOrder.length
    ? brandOrder
    : (lms?.brandStats ?? []).map(b => b.brand)

  return order.map(brandId => resolveDpsBrandTechnicianResults(lms, brandId))
}

export function resolveDpsBrandResultsById(lms, brandOrder = []) {
  return Object.fromEntries(
    resolveDpsBrandResultsMap(lms, brandOrder).map(result => [result.brand, result]),
  )
}

function averagesFromEvaluations(evaluations, brandOrder, tierScope, rosterLookup) {
  /** @type {Record<string, Record<string, Record<string, { theory?: number, practical?: number, manager?: number, inProgress?: boolean }>>>} */
  const byBrand = {}

  for (const e of evaluations ?? []) {
    if (e.kind !== 'competency') continue
    const brands = e.brands?.length ? e.brands : (e.brand ? [e.brand] : [])
    if (!brands.length) continue

    const collaboratorKey = e.collaboratorName
      || e.medacap?.userId
      || e.id
      || 'unknown'
    const modality = competencyModalityKey(e)

    for (const brand of brands) {
      // Filtrage strict : chaque technicien n'est compté que dans son brandLevel net
      const brandLevel = resolveTechnicianBrandLevel(
        { name: e.collaboratorName, medacapLevel: e.medacapLevel ?? e.collaboratorLevel ?? e.userLevel },
        collaboratorKey,
        brand,
        rosterLookup,
      )
      const tier = e.competencyTier ?? 'junior'
      if (tier !== brandLevel) continue
      if (tierScope !== DPS_RESULT_TIER_ALL && tier !== tierScope) continue

      if (!byBrand[brand]) byBrand[brand] = {}
      if (!byBrand[brand][collaboratorKey]) {
        byBrand[brand][collaboratorKey] = {
          junior: {},
          senior: {},
          expert: {},
        }
      }
      const row = byBrand[brand][collaboratorKey][tier]
      mergeCompetencyEvalIntoTierRow(row, e, modality)
    }
  }

  return Object.fromEntries(
    brandOrder.map(brandId => {
      const collaborators = byBrand[brandId]
      if (!collaborators) {
        return [brandId, { evaluated: 0, avgScore: null }]
      }
      return [brandId, dpsBrandScoresFromCollaborators(collaborators, tierScope)]
    }),
  )
}

/**
 * Moyenne et effectifs évalués par marque (filiale DPS), optionnellement par palier.
 * Priorité : brandStats ; repli sur collaboratorEvaluations.
 */
export function resolveDpsBrandTestAverages(lms, brandOrder = [], tierScope = DPS_RESULT_TIER_ALL) {
  const statsByBrand = Object.fromEntries((lms?.brandStats ?? []).map(b => [b.brand, b]))
  const rosterLookup = buildDpsTechnicianRosterLookup(lms?.technicians)
  const order = brandOrder.length
    ? brandOrder
    : (lms?.brandStats ?? []).map(b => b.brand)

  const evalFallback = averagesFromEvaluations(
    lms?.collaboratorEvaluations,
    order,
    tierScope,
    rosterLookup,
  )

  return order.map(brandId => {
    const stat = statsByBrand[brandId]
    const fromStat = tierSlice(stat, tierScope)
    const fromEval = evalFallback[brandId] ?? { evaluated: 0, avgScore: null }

    const hasStatTier = (fromStat.evaluated ?? 0) > 0 || fromStat.avgScore != null
    const avgScore = fromEval.avgScore != null ? fromEval.avgScore : fromStat.avgScore
    const evaluated = fromEval.evaluated > 0 ? fromEval.evaluated : (fromStat.evaluated ?? 0)

    return {
      brand: brandId,
      technicians: stat?.technicians ?? 0,
      evaluated,
      avgScore,
      tierScope,
    }
  })
}

/**
 * Synthèse résultats par marque — score global + moyennes par palier (Maintenance, Réparation, Diagnostic).
 */
export function resolveDpsBrandTestSummaries(lms, brandOrder = []) {
  const statsByBrand = Object.fromEntries((lms?.brandStats ?? []).map(b => [b.brand, b]))
  const rosterLookup = buildDpsTechnicianRosterLookup(lms?.technicians)
  const order = brandOrder.length
    ? brandOrder
    : (lms?.brandStats ?? []).map(b => b.brand)

  const evalFallbackAll = averagesFromEvaluations(
    lms?.collaboratorEvaluations,
    order,
    DPS_RESULT_TIER_ALL,
    rosterLookup,
  )
  const evalFallbackByTier = Object.fromEntries(
    DPS_RESULT_TIER_KEYS.map(tierKey => [
      tierKey,
      averagesFromEvaluations(lms?.collaboratorEvaluations, order, tierKey, rosterLookup),
    ]),
  )

  return order.map(brandId => {
    const stat = statsByBrand[brandId]
    const fromStatGlobal = tierSlice(stat, DPS_RESULT_TIER_ALL)
    const fromEvalGlobal = evalFallbackAll[brandId] ?? { evaluated: 0, avgScore: null }
    const avgScoreGlobal = fromEvalGlobal.avgScore != null ? fromEvalGlobal.avgScore : fromStatGlobal.avgScore
    const evaluatedGlobal = fromEvalGlobal.evaluated > 0 ? fromEvalGlobal.evaluated : (fromStatGlobal.evaluated ?? 0)

    const tiers = {}
    for (const tierKey of DPS_RESULT_TIER_KEYS) {
      const fromStatTier = tierSlice(stat, tierKey)
      const fromEvalTier = evalFallbackByTier[tierKey]?.[brandId] ?? { avgScore: null, evaluated: 0 }
      const avgScore = fromEvalTier.avgScore != null ? fromEvalTier.avgScore : fromStatTier.avgScore
      const evaluated = fromEvalTier.evaluated > 0 ? fromEvalTier.evaluated : (fromStatTier.evaluated ?? 0)
      if (avgScore != null || (evaluated ?? 0) > 0) {
        tiers[tierKey] = { avgScore, evaluated: evaluated ?? 0 }
      }
    }

    const tierAvgScores = Object.values(tiers)
      .map(t => t.avgScore)
      .filter(s => s != null)
    const simpleAvgGlobal = tierAvgScores.length
      ? Math.round(tierAvgScores.reduce((sum, s) => sum + s, 0) / tierAvgScores.length)
      : avgScoreGlobal

    return {
      brand: brandId,
      technicians: stat?.technicians ?? 0,
      evaluated: evaluatedGlobal,
      avgScore: simpleAvgGlobal,
      tiers,
    }
  })
}

/** Priorités DPS — lien Define + alertes filiale. */
export function resolveDpsNextActions(lms) {
  if (!lms) return []
  const actions = [{ id: 'define', kind: 'define' }]
  for (const alert of lms.alerts ?? []) {
    actions.push({ id: alert.id, kind: 'alert', data: alert })
  }
  return actions
}

/**
 * Matrice complète d'un palier (Junior, Senior, Expert) :
 * Techniciens (Nom, Agence, Poste) × Marques de l'atelier,
 * avec note min(Théorie, Pratique) ou statut explicite d'attente.
 */
export function resolveDpsTierMatrix(lms, tierKey, brandList = []) {
  const rosterLookup = buildDpsTechnicianRosterLookup(lms?.technicians)
  const normTier = normalizeDpsCompetencyTier(tierKey) || 'junior'

  const allTechs = (lms?.technicians ?? []).filter(t => {
    return resolveTechnicianGlobalLevel(t, t.username || t.id, rosterLookup) === normTier
  })

  let sourceTechs = allTechs
  if (!sourceTechs.length) {
    const seen = new Set()
    const found = []
    for (const e of lms?.collaboratorEvaluations ?? []) {
      if (e.kind !== 'competency') continue
      if (normalizeDpsCompetencyTier(e.competencyTier) !== normTier) continue
      const name = e.collaboratorName
      if (!name || seen.has(name)) continue
      seen.add(name)
      found.push({
        id: e.medacap?.userId || name,
        name,
        agency: e.agency || null,
        primaryTier: normTier,
        brands: e.brands || (e.brand ? [e.brand] : []),
      })
    }
    sourceTechs = found
  }

  const normalizedBrands = brandList.map(b => {
    if (typeof b === 'string') {
      const def = TEAM_BRAND_DEFS[b]
      return { id: b, label: def?.label || b, logo: def?.logo }
    }
    return b
  }).filter(b => b.id !== 'toutes-marques')

  const rows = sourceTechs.map(tech => {
    const { firstName, lastName } = splitCollaboratorName(tech.name)
    const brandScores = {}

    for (const brand of normalizedBrands) {
      const brandId = brand.id
      let theory = null
      let practical = null
      let declarativeStage = null
      let hasEval = false
      let inProgress = false

      for (const e of lms?.collaboratorEvaluations ?? []) {
        if (e.kind !== 'competency') continue
        if (String(e.collaboratorName ?? '').trim().toLowerCase() !== String(tech.name ?? '').trim().toLowerCase()) continue
        const eBrands = brandsFromCollaboratorEvaluation(e).map(b => String(b).toLowerCase())
        if (!eBrands.includes(brandId.toLowerCase())) continue
        if (normalizeDpsCompetencyTier(e.competencyTier) !== normTier) continue

        hasEval = true
        if (e.status === 'done' && e.score != null) {
          if (e.modality === 'theory') theory = e.score
          else if (e.modality === 'practical') practical = e.score
        } else if (e.status === 'progress') {
          inProgress = true
          if (e.declarativeStage) declarativeStage = e.declarativeStage
        } else if (e.declarativeStage) {
          declarativeStage = e.declarativeStage
        }
      }

      if (theory != null && practical != null) {
        brandScores[brandId] = {
          score: Math.min(theory, practical),
          theory,
          practical,
          status: 'done',
          label: `${Math.min(theory, practical)}%`,
        }
      } else if (hasEval) {
        if (theory != null && practical == null) {
          brandScores[brandId] = {
            score: null,
            theory,
            practical: null,
            status: 'pending_practical',
            labelKey: 'dps_tier_matrix_status_pending_practical',
          }
        } else if (practical != null && theory == null) {
          brandScores[brandId] = {
            score: null,
            theory: null,
            practical,
            status: 'pending_theory',
            labelKey: 'dps_tier_matrix_status_pending_theory',
          }
        } else if (declarativeStage === 'awaiting_manager') {
          brandScores[brandId] = {
            score: null,
            status: 'pending_manager',
            labelKey: 'dps_tier_matrix_status_pending_manager',
          }
        } else {
          brandScores[brandId] = {
            score: null,
            status: 'in_progress',
            labelKey: 'dps_results_brand_pending',
          }
        }
      } else {
        const techBrands = (tech.brands || []).map(b => String(b).toLowerCase())
        const isAssigned = techBrands.includes(brandId.toLowerCase())
        if (isAssigned) {
          brandScores[brandId] = {
            score: null,
            status: 'not_evaluated',
            labelKey: 'dps_tier_matrix_status_not_evaluated',
          }
        } else {
          brandScores[brandId] = {
            score: null,
            status: 'unassigned',
            labelKey: 'dps_tier_matrix_status_unassigned',
          }
        }
      }
    }

    return {
      id: tech.id || tech.username || tech.name,
      name: tech.name,
      firstName,
      lastName,
      agency: tech.agency || '—',
      job: normTier === 'expert' ? 'Diagnostiqueur' : (normTier === 'senior' ? 'Réparateur' : 'Maintenancier'),
      brandScores,
    }
  })

  rows.sort(compareTechnicianTableRows)

  const allScores = []
  let evaluatedCount = 0
  for (const row of rows) {
    let hasAnyDone = false
    for (const b of normalizedBrands) {
      const bs = row.brandScores[b.id]
      if (bs?.score != null) {
        allScores.push(bs.score)
        hasAnyDone = true
      }
    }
    if (hasAnyDone) evaluatedCount++
  }

  const avgScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : null

  return {
    tierKey: normTier,
    brands: normalizedBrands,
    technicians: rows,
    avgScore,
    techniciansCount: rows.length,
    evaluatedCount,
  }
}

/**
 * Résumé des 3 niveaux pour la section « Compétences des techniciens par niveau ».
 */
export function resolveDpsTierSummaries(lms, brandList = []) {
  return DPS_RESULT_TIER_KEYS.map(tierKey => {
    const matrix = resolveDpsTierMatrix(lms, tierKey, brandList)
    const labelKey = tierKey === 'expert'
      ? 'dps_results_tier_diagnostic'
      : (tierKey === 'senior' ? 'dps_results_tier_repair' : 'dps_results_tier_maintenance')
    return {
      tierKey,
      labelKey,
      avgScore: matrix.avgScore,
      techniciansCount: matrix.techniciansCount,
      evaluatedCount: matrix.evaluatedCount,
    }
  })
}

