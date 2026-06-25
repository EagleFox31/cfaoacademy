/** Membres d'équipe — chef d'équipe ou agrégat chef d'atelier. */
export function resolveTeamMembers(lms, { workshop = false } = {}) {
  if (!lms) return []
  if (workshop) return lms.teams?.flatMap(te => te.membres) ?? []
  return lms.team ?? []
}

function memberPathwayPct(member) {
  if (member.pathwayPct != null) return member.pathwayPct
  return member.progress ?? 0
}

function memberCompetencyPct(member) {
  if (member.competencyPct != null) return member.competencyPct
  return null
}

/** Avancement moyen de la mesure des compétences (équipe). */
export function computeTeamCompetencyMetrics(members = []) {
  const values = members.map(memberCompetencyPct).filter(v => v != null)
  if (!values.length) return { pct: 0, done: 0, total: 0 }
  const done = members.reduce((s, m) => s + (m.competencyDone ?? 0), 0)
  const total = members.reduce((s, m) => s + (m.competencyTotal ?? 0), 0)
  const pct = total > 0
    ? Math.round((done / total) * 100)
    : Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  return { pct, done, total }
}

/** Avancement global des parcours de formation (équipe). */
export function computeTeamPathwayMetrics(members = []) {
  const done = members.reduce((s, m) => s + (m.pathwayDone ?? m.modulesDone ?? 0), 0)
  const total = members.reduce((s, m) => s + (m.pathwayTotal ?? m.modulesTotal ?? 0), 0)
  const pct = total > 0
    ? Math.round((done / total) * 100)
    : (members.length
        ? Math.round(members.reduce((s, m) => s + memberPathwayPct(m), 0) / members.length)
        : 0)
  return { pct, done, total }
}

export function getTeamPendingValidations(lms) {
  return lms?.pendingValidations ?? []
}

export function countMembersWithPendingTest(lms, members) {
  const ids = new Set((lms?.pendingValidations ?? []).map(p => p.memberId))
  return members.filter(m => ids.has(m.id)).length
}

/** Synthèse résultats équipe par grand type (compétences / formations). */
export function computeTeamResultsByGroup(members = []) {
  const competency = { done: 0, total: 0 }
  const formation = { done: 0, total: 0 }
  for (const m of members) {
    for (const e of m.evaluations ?? []) {
      const bucket = e.kind === 'formation' ? formation : competency
      bucket.total += 1
      if (e.status === 'done') bucket.done += 1
    }
  }
  const pct = (bucket) => (bucket.total > 0 ? Math.round((bucket.done / bucket.total) * 100) : 0)
  return {
    competency: { ...competency, pct: pct(competency) },
    formation: { ...formation, pct: pct(formation) },
  }
}

export function filterTeamMembers(members, filterId, lms) {
  if (filterId === 'all') return members
  if (filterId === 'alert') return members.filter(m => m.alert)
  if (filterId === 'pending_test') {
    const ids = new Set((lms?.pendingValidations ?? []).map(p => p.memberId))
    return members.filter(m => ids.has(m.id))
  }
  return members.filter(m => m.brand === filterId)
}

export const TEAM_FILTER_IDS = ['all', 'alert', 'pending_test']

export function teamBrandFilterIds(members) {
  return [...new Set(members.map(m => m.brand).filter(Boolean))]
}

export function countTeamPlansInProgress(members, year) {
  let sessions = 0
  for (const m of members) {
    for (const p of m.planPathway ?? []) {
      if (p.date?.startsWith(String(year)) && p.annualStatus !== 'fait') sessions += 1
    }
  }
  return sessions
}
