import { findCatalogTraining } from './assignedTrainings.js'
import { resolveLearnerPlanningSessions } from './learnerPlanning.js'
import { isFormationTestUnlocked, isEvalDone } from './learnerTests.js'
import { resolveLearnerPifItems, PIF_SCOPE_PLURI } from './learnerPif.js'

const MAX_ACTIONS = 3
const URGENT_SESSION_DAYS = 14

/** Ordre d'activité — plus petit = plus prioritaire (remonte en tête). */
const EVAL_ACTIVITY_ORDER = { progress: 0, todo: 1, upcoming: 2 }
const SESSION_ACTIVITY_ORDER = { en_cours: 0, inscrit: 1, a_inscrire: 2 }

const MOIS_FR = {
  'janv.': 0, 'févr.': 1, 'mars': 2, 'avr.': 3, 'mai': 4, 'juin': 5,
  'juil.': 6, 'août': 7, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11,
}

function parseLocalDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysUntilIso(iso) {
  if (!iso) return Infinity
  const target = parseLocalDate(iso)
  return Math.ceil((target - startOfToday()) / 86400000)
}

/** Dates FR des évaluations (« 15 juil. 2026 », « Juin 2026 »). */
function parseEvalDate(dateStr) {
  if (!dateStr || dateStr === '—') return null
  const full = dateStr.match(/(\d{1,2})\s+([\wéèû.]+)\s+(\d{4})/)
  if (full) {
    const month = MOIS_FR[full[2]]
    if (month != null) return new Date(Number(full[3]), month, Number(full[1]))
  }
  const monthOnly = dateStr.match(/^([\wéèû.]+)\s+(\d{4})$/)
  if (monthOnly) {
    const month = MOIS_FR[monthOnly[1]]
    if (month != null) return new Date(Number(monthOnly[2]), month, 1)
  }
  return null
}

function daysUntilEval(dateStr) {
  const d = parseEvalDate(dateStr)
  if (!d) return Infinity
  return Math.ceil((d - startOfToday()) / 86400000)
}

function evalMatchesCertGoal(evalItem, targetLevels) {
  if (!targetLevels.length || evalItem.kind !== 'formation' || !evalItem.code) return false
  const catalog = findCatalogTraining(evalItem.brand, evalItem.code)
  return catalog?.catalogLevel && targetLevels.includes(catalog.catalogLevel)
}

export function sessionFormationTitle(session) {
  const brand = session.brand ?? (session.marque ?? '').toLowerCase()
  const catalog = findCatalogTraining(brand, session.code)
  return catalog?.name ?? session.nom ?? session.title ?? session.code ?? ''
}

function buildEvalCandidate(evalItem) {
  if (evalItem.status === 'progress') {
    const answered = evalItem.questionsAnswered ?? 0
    const total = evalItem.questions ?? 0
    return {
      id: `eval-${evalItem.id}`,
      kind: 'eval',
      score: 900,
      data: evalItem,
      badge: 'progress',
      trailing: total > 0 ? `${answered}/${total}` : null,
    }
  }

  if (evalItem.status === 'upcoming' || evalItem.status === 'todo') {
    const days = daysUntilEval(evalItem.date)
    const base = evalItem.kind === 'formation' ? 720 : 680
    return {
      id: `eval-${evalItem.id}`,
      kind: 'eval',
      score: base - Math.min(days, 365),
      data: evalItem,
      badge: evalItem.status === 'upcoming' ? 'upcoming' : 'todo',
      trailing: evalItem.date !== '—' ? evalItem.date : null,
    }
  }

  return null
}

function buildSessionCandidate(session) {
  const status = session.annualStatus ?? 'a_inscrire'
  const days = daysUntilIso(session.date)

  if (status === 'fait' || status === 'a_programmer') return null

  if (status === 'en_cours') {
    return {
      id: `session-${session.uid ?? session.id}`,
      kind: 'session',
      score: 1000,
      data: session,
      badge: 'en_cours',
      trailing: session.dateRange ?? null,
    }
  }

  if (status === 'inscrit') {
    const score = days <= URGENT_SESSION_DAYS ? 850 - days : 760 - Math.min(days, 200)
    return {
      id: `session-${session.uid ?? session.id}`,
      kind: 'session',
      score,
      data: session,
      badge: 'inscrit',
      trailing: session.dateRange ?? null,
      daysUntil: days,
    }
  }

  if (status === 'a_inscrire' || status === 'todo') {
    return {
      id: `session-${session.uid ?? session.id}`,
      kind: 'session',
      score: 640 - Math.min(days, 300),
      data: session,
      badge: 'a_inscrire',
      trailing: session.dateRange ?? null,
      daysUntil: days,
    }
  }

  return null
}

function dedupeById(items) {
  const seen = new Set()
  return items.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

/** Tri activité (statut) puis urgence (score décroissant) à statut égal. */
function sortByActivityThenUrgency(items, orderMap) {
  return [...items].sort((a, b) => {
    const oa = orderMap[a.badge] ?? 9
    const ob = orderMap[b.badge] ?? 9
    if (oa !== ob) return oa - ob
    return b.score - a.score
  })
}

const EMPTY_ACTIONS = { category: null, items: [], sectionId: null }

/**
 * Comportement historique du portail (tous profils SAUF variante PL-MEDACAP) :
 * jusqu'à 3 items mélangés (tests + sessions), triés par urgence.
 * Retour enveloppé en { category: 'mixed', items } pour une signature unique.
 */
function resolveLegacyNextActions(user, lms, year) {
  const targetLevels = (lms.certGoals ?? []).map(g => g.targetLevel).filter(Boolean)
  const candidates = []

  for (const e of lms.evaluations ?? []) {
    if (!isFormationTestUnlocked(user, lms, e, year)) continue
    const c = buildEvalCandidate(e)
    if (!c) continue
    if (evalMatchesCertGoal(e, targetLevels)) c.score += 30
    candidates.push(c)
  }

  for (const s of resolveLearnerPlanningSessions(user, lms, year)) {
    const c = buildSessionCandidate(s)
    if (c) candidates.push(c)
  }

  const items = dedupeById(candidates.sort((a, b) => b.score - a.score))
    .slice(0, MAX_ACTIONS)
    .map((item, index) => ({ ...item, primary: index === 0 }))

  return { category: items.length ? 'mixed' : null, items, sectionId: null }
}

/**
 * Variante PL-MEDACAP uniquement — UNE SEULE catégorie affichée à la fois
 * (jamais deux types mélangés). Chaîne de priorité pilotée par l'activité,
 * alignée méthode MEDACAP (Mesurer → Définir → Acquérir) :
 *
 *   1. `tests`      — il reste ≥1 test non terminé (progress/todo/upcoming).
 *   2. `results`    — tous les tests de compétence sont terminés, mais aucun
 *                     item PIF n'existe encore : on montre les résultats.
 *   3. `pif`        — tests terminés ET le PIF a des entrées (plan post-test).
 *   4. `formations` — sinon : sessions du niveau immédiatement supérieur (N+1)
 *                     à venir — section « Formations suggérées ».
 */
function resolvePlMedacapNextActions(user, lms, year) {
  const targetLevels = (lms.certGoals ?? []).map(g => g.targetLevel).filter(Boolean)
  const evaluations = lms.evaluations ?? []
  const competencyEvals = evaluations.filter(e => e.kind === 'competency')

  // ── 1. Tests non terminés ───────────────────────────────────────────
  const evalCandidates = []
  for (const e of evaluations) {
    if (!isFormationTestUnlocked(user, lms, e, year)) continue
    const c = buildEvalCandidate(e)
    if (!c) continue
    if (evalMatchesCertGoal(e, targetLevels)) c.score += 30
    evalCandidates.push(c)
  }
  if (evalCandidates.length) {
    return {
      category: 'tests',
      sectionId: 'tests',
      items: sortByActivityThenUrgency(dedupeById(evalCandidates), EVAL_ACTIVITY_ORDER)
        .map((item, index) => ({ ...item, primary: index === 0 })),
    }
  }

  // ── 2 & 3. Tests de compétence tous terminés → Résultats puis PIF ────
  const allCompetencyDone = competencyEvals.length > 0
    && competencyEvals.every(isEvalDone)

  if (allCompetencyDone) {
    const hasPif = resolveLearnerPifItems(user, lms, PIF_SCOPE_PLURI).length > 0
    if (hasPif) return { category: 'pif', sectionId: 'pif', items: [] }
    return { category: 'results', sectionId: 'resultats', items: [] }
  }

  // ── 4. Formations suggérées (planning N+1) ──────────────────────────
  const sessionCandidates = []
  for (const s of resolveLearnerPlanningSessions(user, lms, year, { targetLevelOnly: true })) {
    const c = buildSessionCandidate(s)
    if (c) sessionCandidates.push(c)
  }
  if (sessionCandidates.length) {
    return {
      category: 'formations',
      sectionId: 'formations-suggerees',
      items: sortByActivityThenUrgency(dedupeById(sessionCandidates), SESSION_ACTIVITY_ORDER)
        .map((item, index) => ({ ...item, primary: index === 0 })),
    }
  }

  return EMPTY_ACTIONS
}

/** Priorités communes : formations suggérées d'abord, tests ensuite. */
function resolvePriorityActions(user, lms, year) {
  const sessionCandidates = resolveLearnerPlanningSessions(
    user,
    lms,
    year,
    { targetLevelOnly: true },
  )
    .map(buildSessionCandidate)
    .filter(Boolean)

  if (sessionCandidates.length) {
    return {
      category: 'formations',
      sectionId: 'formations-suggerees',
      items: sortByActivityThenUrgency(
        dedupeById(sessionCandidates),
        SESSION_ACTIVITY_ORDER,
      ).map((item, index) => ({ ...item, primary: index === 0 })),
    }
  }

  const targetLevels = (lms.certGoals ?? []).map(g => g.targetLevel).filter(Boolean)
  const evalCandidates = []
  for (const e of lms.evaluations ?? []) {
    if (!isFormationTestUnlocked(user, lms, e, year)) continue
    const candidate = buildEvalCandidate(e)
    if (!candidate) continue
    if (evalMatchesCertGoal(e, targetLevels)) candidate.score += 30
    evalCandidates.push(candidate)
  }

  return {
    category: evalCandidates.length ? 'tests' : null,
    sectionId: 'tests',
    items: sortByActivityThenUrgency(
      dedupeById(evalCandidates),
      EVAL_ACTIVITY_ORDER,
    ).map((item, index) => ({ ...item, primary: index === 0 })),
  }
}

/**
 * Point d'entrée. Les priorités n'affichent qu'une catégorie à la fois :
 * formations suggérées, ou tests si aucune formation n'est à venir.
 */
export function resolveLearnerNextActions(user, lms, year = 2026) {
  if (!user || !lms) return EMPTY_ACTIONS
  return resolvePriorityActions(user, lms, year)
}
