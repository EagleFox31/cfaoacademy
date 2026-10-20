import {
  enrichAssignedTrainings,
  findCatalogTraining,
  resolveLearnerAssignedTrainings,
} from './assignedTrainings.js'
import {
  formatSessionDateRange,
  resolvePlanItemYear,
  resolvePlanScopePhase,
  planningSessionAccent,
  summarizeAnnualStatuses,
} from './learnerPlanning.js'
import { isPlMedacapVariant } from './portalVariant.js'

export const PIF_SCOPE_PLURI = 'pluri'
export const PIF_YEARS = [2026, 2025, 2024]

const COMPETENCY_TIERS = ['junior', 'senior', 'expert']
const EXPERT_EMPTY_PLAN_MIN_SCORE = 99
const EXPERT_TIER_MIN_SCORE = 80

const ANNUAL_TO_PLAN_STATUS = {
  fait: 'done',
  en_cours: 'progress',
  inscrit: 'scheduled',
  a_inscrire: 'todo',
  a_programmer: 'todo',
}

function resolveCodeBrand(code, user) {
  for (const id of user?.brands ?? []) {
    if (findCatalogTraining(id, code)) return id.toLowerCase()
  }
  return user?.brands?.[0]?.toLowerCase() ?? 'toyota'
}

function itemsFromPlanningStatus(user, lms, year) {
  const statusMap = lms?.planningStatus ?? {}
  const raw = []

  for (const [key, annualStatus] of Object.entries(statusMap)) {
    const pipe = key.indexOf('|')
    if (pipe < 0) continue
    const date = key.slice(0, pipe)
    const code = key.slice(pipe + 1)
    if (!code || !date?.startsWith(String(year))) continue

    const brand = resolveCodeBrand(code, user)
    const catalog = findCatalogTraining(brand, code)
    raw.push({
      id: `pif-hist-${key}`,
      code,
      brand,
      title: catalog?.name ?? code,
      date,
      fin: date,
      dateRange: formatSessionDateRange(date, date),
      annualStatus,
      status: ANNUAL_TO_PLAN_STATUS[annualStatus] ?? 'todo',
      modality: 'presentiel',
      year,
      lieu: user?.orgLabel ?? user?.filiale,
      catalogLevel: catalog?.catalogLevel ?? null,
    })
  }

  return enrichAssignedTrainings(raw)
}

function dedupePlanItems(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = `${item.brand}|${item.code}|${item.date ?? ''}|${item.modality ?? 'presentiel'}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Entrées PIF pour un filtre (pluri annuel ou année précise). */
export function resolveLearnerPifItems(user, lms, scope) {
  if (!user || !lms) return []

  if (scope === PIF_SCOPE_PLURI) {
    return dedupePlanItems(
      PIF_YEARS.flatMap(year => resolveLearnerPifItems(user, lms, year)),
    )
  }

  const year = Number(scope)
  // Variante PL-MEDACAP : le PIF est un plan post-diagnostic — uniquement
  // planPathway / assignedTrainings / planningStatus explicites, aucun repli
  // sur le planning annuel brut (le PIF reste vide tant que rien n'est planifié).
  // Tous les autres profils : comportement historique inchangé.
  const fallbackToPlanning = !isPlMedacapVariant(lms)
  const fromPlan = resolveLearnerAssignedTrainings(user, lms, year, { fallbackToPlanning })
    .filter(item => resolvePlanItemYear(item) === year)

  const fromHistory = itemsFromPlanningStatus(user, lms, year)
  return dedupePlanItems([...fromPlan, ...fromHistory])
    .filter(item => resolvePlanItemYear(item) === year)
    .sort((a, b) => {
      const da = a.date ?? '9999'
      const db = b.date ?? '9999'
      return da.localeCompare(db)
    })
}

/** Regroupe les entrées PIF par marque (ordre profil). */
export function groupPifItemsByBrand(items = [], brandOrder = []) {
  const order = [...brandOrder]
  const groups = Object.fromEntries(brandOrder.map(id => [id, []]))

  for (const item of items) {
    const brand = item.brand
    if (!brand) continue
    if (!groups[brand]) {
      groups[brand] = []
      if (!order.includes(brand)) order.push(brand)
    }
    groups[brand].push(item)
  }

  return { groups, order }
}

export function pifItemToSession(item) {
  return {
    ...item,
    nom: item.title ?? item.nom ?? item.code,
    marque: item.marque ?? item.brand,
    uid: item.id ?? item.uid,
  }
}

function pifItemsForBrand(user, lms, brandId, scope) {
  const resolvedScope = scope === PIF_SCOPE_PLURI ? PIF_SCOPE_PLURI : Number(scope)
  return resolveLearnerPifItems(user, lms, resolvedScope)
    .filter(item => item.brand === brandId)
}

function pifProgressForBrand(user, lms, brandId, scope) {
  const items = pifItemsForBrand(user, lms, brandId, scope)
  return {
    items,
    ...summarizeAnnualStatuses(items.map(item => item.annualStatus).filter(Boolean)),
  }
}

function resolvePluriBrandAnnualStatus(items) {
  const summary = summarizeAnnualStatuses(items.map(item => item.annualStatus).filter(Boolean))
  const currentYear = new Date().getFullYear()

  if (!summary.total) return 'a_programmer'
  if (summary.done === summary.total) return 'fait'
  if (summary.inProgress > 0) return 'en_cours'

  const hasOpenCurrentOrFuture = items.some(item => {
    const year = resolvePlanItemYear(item)
    return year != null && year >= currentYear && item.annualStatus !== 'fait'
  })
  if (hasOpenCurrentOrFuture) {
    if (summary.done > 0) return 'en_cours'
    if (summary.enrolled > 0) return 'inscrit'
    if (summary.toEnroll > 0) return 'a_inscrire'
    return 'a_programmer'
  }

  if (summary.done > 0) return 'partiel'
  if (summary.toSchedule > 0 && summary.toEnroll === 0 && summary.enrolled === 0) {
    return 'a_programmer'
  }
  return 'non_fait'
}

function resolveAnnualBrandStatusFromProgress(summary, phase) {
  if (!summary.total) return null
  if (summary.done === summary.total) return 'fait'
  if (summary.inProgress > 0) return 'en_cours'

  if (phase === 'current' || phase === 'future') {
    if (summary.done > 0) return 'en_cours'
    if (summary.enrolled > 0) return 'inscrit'
    if (summary.toEnroll > 0) return 'a_inscrire'
    return 'a_programmer'
  }

  if (phase === 'past') {
    if (summary.done > 0) return 'partiel'
    if (summary.toSchedule > 0 && summary.toEnroll === 0 && summary.enrolled === 0) {
      return 'a_programmer'
    }
    return 'non_fait'
  }

  return 'a_inscrire'
}

function resolvePifBrandAnnualStatusFromItems(user, lms, brandId, scope) {
  const { items, ...summary } = pifProgressForBrand(user, lms, brandId, scope)
  const phase = resolvePlanScopePhase(scope, PIF_SCOPE_PLURI)

  if (!summary.total) {
    if (scope !== PIF_SCOPE_PLURI) return 'a_programmer'
    if (isBrandExpertPlanComplete(user, lms, brandId)) return 'fait'
    return 'a_programmer'
  }

  if (phase === 'pluri') return resolvePluriBrandAnnualStatus(items)

  return resolveAnnualBrandStatusFromProgress(summary, phase) ?? 'a_inscrire'
}

/** Progression marque PIF — utile pour affichage 01/02. */
export function resolvePifBrandProgress(user, lms, brandId, scope) {
  const { items, ...summary } = pifProgressForBrand(user, lms, brandId, scope)
  return {
    ...summary,
    annualStatus: resolvePifBrandAnnualStatusFromItems(user, lms, brandId, scope),
    phase: resolvePlanScopePhase(scope, PIF_SCOPE_PLURI),
    items,
  }
}

/** Statut annuel dominant d'une marque PIF — même logique que la bordure. */
export function resolvePifBrandAnnualStatus(user, lms, brandId, scope) {
  return resolvePifBrandAnnualStatusFromItems(user, lms, brandId, scope)
}

/** Statuts inscription / planification — vocabulaire apprenant, pas DPS filiale. */
const DPS_FILIALE_HIDDEN_ANNUAL_STATUSES = new Set([
  'inscrit',
  'a_inscrire',
  'a_programmer',
])

function normalizeBrandByYear(byYear) {
  if (!byYear || Array.isArray(byYear)) return {}
  return byYear
}

function resolveDpsFilialePifProposedRow(lms, brandId, scope) {
  const brandSummary = lms?.brandPlanningSummary?.[brandId]
  if (!brandSummary) return null
  if (scope === PIF_SCOPE_PLURI) return brandSummary
  const year = String(scope)
  const byYear = normalizeBrandByYear(brandSummary.byYear)
  return byYear[year] ?? { total: 0, done: 0 }
}

/** Validés filiale (x) — branché depuis brandPlanningSummary.byYear. */
export function resolveDpsFilialePifValidatedCount(lms, brandId, scope) {
  const row = resolveDpsFilialePifProposedRow(lms, brandId, scope)
  return row?.done ?? 0
}

/** Statut annuel DPS filiale — badge désactivé tant que x (validés filiale) n'est pas calculé. */
export function resolveDpsFilialePifAnnualStatus(user, lms, brandId, scope) {
  const row = resolveDpsFilialePifProposedRow(lms, brandId, scope)
  if (!row?.total) return 'a_programmer'
  return null
}

/** Puce statut DPS : synthèse d'avancement seulement (pas inscrit / à programmer). */
export function resolveDpsFilialePifStatus(annualStatus) {
  if (!annualStatus || DPS_FILIALE_HIDDEN_ANNUAL_STATUSES.has(annualStatus)) return null
  return annualStatus
}

/** Bordure carte PIF filiale — avancement x/y quand disponible. */
export function resolveDpsFilialePifAccentColor(user, lms, brandId, scope) {
  const row = resolveDpsFilialePifProposedRow(lms, brandId, scope)
  if (!row?.total) return 'var(--muted)'
  const done = row.done ?? 0
  const total = row.total ?? 0
  if (total <= 0) return 'var(--muted)'
  const ratio = done / total
  if (ratio >= 0.7) return '#1aab5b'
  if (ratio > 0) return '#e67e00'
  return 'var(--navy)'
}

/** Total formations PIF filiale pour les filtres année / pluri. */
export function resolveDpsFilialePifScopeCount(lms, scope) {
  const summary = lms?.brandPlanningSummary
  if (!summary || typeof summary !== 'object') return null

  if (scope === PIF_SCOPE_PLURI) {
    return Object.values(summary).reduce((sum, row) => sum + (row?.total ?? 0), 0)
  }

  const year = String(scope)
  return Object.values(summary).reduce(
    (sum, row) => sum + (normalizeBrandByYear(row?.byYear)[year]?.total ?? 0),
    0,
  )
}

/** Compteur PIF filiale DPS — pluri = allocations Define ; année = y/x pool 2025 par marque. */
export function resolveDpsFilialePifCardState(lms, brandId, user, scope, t) {
  const brandSummary = lms?.brandPlanningSummary?.[brandId]
  if (scope === PIF_SCOPE_PLURI && brandSummary?.total > 0) {
    const year2025 = normalizeBrandByYear(brandSummary.byYear)['2025']
    return {
      kind: 'count',
      current: brandSummary.total,
      done: year2025?.done ?? brandSummary.done ?? 0,
      total: brandSummary.total,
      muted: false,
    }
  }

  if (brandSummary && scope !== PIF_SCOPE_PLURI) {
    const row = resolveDpsFilialePifProposedRow(lms, brandId, scope)
    if (row.total > 0) {
      return {
        kind: 'count',
        current: row.total,
        done: row.done ?? 0,
        total: row.total,
        muted: false,
      }
    }
    return {
      kind: 'empty_year',
      lines: [t.pif_card_line_empty_year.replace('{year}', String(scope))],
      muted: true,
    }
  }

  return resolvePifBrandCardState(lms, brandId, user, scope, t)
}

/** Bordure carte PIF — même convention que les sessions (planningSessionAccent). */
export function resolvePifBrandAccentColor(user, lms, brandId, scope) {
  return planningSessionAccent(resolvePifBrandAnnualStatusFromItems(user, lms, brandId, scope))
}

function competencyEvalsForBrand(lms, brandId) {
  return (lms?.evaluations ?? []).filter(
    entry => entry.kind === 'competency' && entry.brand === brandId,
  )
}

function tierMinDoneScore(evals, tier) {
  const tierEvals = evals.filter(
    entry => entry.competencyTier === tier && entry.status === 'done',
  )
  if (tierEvals.length < 2) return null
  return Math.min(...tierEvals.map(entry => entry.score ?? 0))
}

function resolveBrandCertLevel(user, lms, brandId) {
  const cert = lms?.certifications?.find(entry => entry.brand === brandId)
  if (cert?.level) return String(cert.level).toUpperCase()
  const goal = lms?.certGoals?.find(entry => entry.brand === brandId)
  if (goal?.currentLevel) return String(goal.currentLevel).toUpperCase()
  const profileLevel = user?.certLevels?.[brandId]
  return profileLevel ? String(profileLevel).toUpperCase() : null
}

/** Expert diagnostic : maintenance, réparation et diagnostic maîtrisés (≥ 80 %). */
export function isBrandExpertTierMastery(user, lms, brandId) {
  if (resolveBrandCertLevel(user, lms, brandId) !== 'EXPERT') return false
  const evals = competencyEvalsForBrand(lms, brandId)
  return COMPETENCY_TIERS.every(tier => {
    const min = tierMinDoneScore(evals, tier)
    return min !== null && min >= EXPERT_TIER_MIN_SCORE
  })
}

/** Plan vide autorisé : expert avec ≥ 99 % sur tous les paliers (théorie + pratique). */
export function isBrandExpertPlanComplete(user, lms, brandId) {
  if (!isBrandExpertTierMastery(user, lms, brandId)) return false
  const evals = competencyEvalsForBrand(lms, brandId)
  return COMPETENCY_TIERS.every(tier => {
    const min = tierMinDoneScore(evals, tier)
    return min !== null && min >= EXPERT_EMPTY_PLAN_MIN_SCORE
  })
}

/**
 * État carte PIF — compteur X/Y, message année vide (carte grisée) ou plan pluri vide (expert seulement).
 * @returns {{ kind: string, current?: number, lines?: string[], muted: boolean }}
 */
export function resolvePifBrandCardState(lms, brandId, user, scope, t) {
  const isAnnual = scope !== PIF_SCOPE_PLURI
  const progress = resolvePifBrandProgress(user, lms, brandId, scope)
  const { total, done } = progress

  if (total > 0) {
    return {
      kind: 'count',
      current: total,
      done,
      total,
      muted: false,
    }
  }

  if (isAnnual) {
    return {
      kind: 'empty_year',
      lines: [t.pif_card_line_empty_year.replace('{year}', String(scope))],
      muted: true,
    }
  }

  if (isBrandExpertPlanComplete(user, lms, brandId)) {
    return {
      kind: 'empty_plan',
      lines: [t.pif_card_line_empty_plan],
      muted: false,
    }
  }

  return {
    kind: 'plan_pending',
    lines: [t.pif_card_line_plan_pending],
    muted: false,
  }
}

export function formatPifFormationCount(count) {
  return String(Math.max(0, count)).padStart(2, '0')
}

export function pifFormationLabel(count, t) {
  return count <= 1 ? t.pif_formation_one : t.pif_formation_many
}

/** @deprecated Utiliser resolvePifBrandCardState */
export function resolvePifBrandMeta(lms, brandId, user, scope, t) {
  return resolvePifBrandCardState(lms, brandId, user, scope, t)
}
