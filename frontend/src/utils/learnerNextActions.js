import { findCatalogTraining } from './assignedTrainings.js'
import { resolveLearnerPlanningSessions } from './learnerPlanning.js'
import { isFormationTestUnlocked } from './learnerTests.js'

const MAX_ACTIONS = 3
const URGENT_SESSION_DAYS = 14

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

/**
 * Prochaines actions apprenant — dérivées du planning (sessions-2026),
 * du catalogue et des tests LMS. Max 3 items, triés par urgence.
 */
export function resolveLearnerNextActions(user, lms, year = 2026) {
  if (!user || !lms) return []

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

  const seen = new Set()
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    .slice(0, MAX_ACTIONS)
    .map((item, index) => ({ ...item, primary: index === 0 }))
}
