const DELIVERY_RW = new Set(['superadmin', 'build_team'])
const DELIVERY_READ = new Set(['superadmin', 'build_team', 'group_admin', 'group_director'])

export function canAccessDelivery(roles = []) {
  return roles.some(r => DELIVERY_READ.has(r))
}

export function canEditDelivery(roles = []) {
  return roles.some(r => DELIVERY_RW.has(r))
}

export function isExecutiveDeliveryView(roles = []) {
  return roles.includes('group_admin') || roles.includes('group_director')
}

export function computeDeliveryKpis(stories) {
  const total = stories.length
  const done = stories.filter(s => s.status === 'done').length
  const inProgress = stories.filter(s => s.status === 'in_progress').length
  const blocked = stories.filter(s => s.status === 'blocked').length
  const pct = total ? Math.round((done / total) * 100) : 0
  return { total, done, inProgress, blocked, pct }
}

export function computeGateProgress(checklist) {
  const total = checklist.length
  const done = checklist.filter(c => c.done).length
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** Progression (done/total + %) d'un sous-ensemble de stories. */
export function computeProgress(stories) {
  const total = stories.length
  const done = stories.filter(s => s.status === 'done').length
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** Stories regroupées par epic, en respectant l'ordre fourni. */
export function groupStoriesByEpic(stories) {
  const map = new Map()
  for (const s of stories) {
    if (!map.has(s.epic)) map.set(s.epic, [])
    map.get(s.epic).push(s)
  }
  return map
}

/** Compte les étapes de tests « OK » sur l'ensemble (hors N/A). */
export function computeTestStats(stories) {
  const keys = ['tu', 'ti', 'contract', 'e2e']
  const out = {}
  for (const k of keys) {
    const applicable = stories.filter(s => s.tests?.[k] && s.tests[k] !== 'na')
    const done = applicable.filter(s => s.tests[k] === 'done').length
    out[k] = { total: applicable.length, done }
  }
  return out
}
