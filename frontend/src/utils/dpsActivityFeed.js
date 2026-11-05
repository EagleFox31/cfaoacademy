import { TEAM_BRAND_DEFS } from './teamBrands.js'
import { evalScoreTier, evalScoreTierClass } from './learnerTests.js'

export const ACTIVITY_PRIMARY_DAYS = ['today', 'yesterday']
export const ACTIVITY_WEEK_GROUPS = ['this_week', 'last_week']
export const MAX_ACTIVITY_WEEK_GROUP = 3

const BRAND_TEXT_HINTS = [
  ['renault trucks', 'renault-trucks'],
  ['renault', 'renault-trucks'],
  ['king long', 'king-long'],
  ['toyota forklift', 'toyota-forklift'],
  ['toyota material', 'toyota-forklift'],
  ['sinotruk', 'sinotruk'],
  ['hino', 'hino'],
  ['fuso', 'fuso'],
  ['suzuki', 'suzuki'],
  ['toyota', 'toyota'],
  ['jcb', 'jcb'],
  ['lovol', 'lovol'],
  ['bt', 'bt'],
  ['yamaha', 'yamaha'],
  ['byd', 'byd'],
  ['mitsubishi', 'mitsubishi'],
  ['mercedes', 'mercedes-benz'],
  ['stellantis', 'stellantis'],
]

function startOfWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

export function inferActivityType(log) {
  if (log.type) return log.type
  const text = String(log.text ?? log.summary ?? '').toLowerCase()
  if (text.includes('alerte')) return 'alert'
  if (text.includes('pif') || text.includes('validation')) return 'pif'
  if (text.includes('test') || text.includes('compétence') || text.includes('mesuré')) return 'test'
  if (text.includes('session') || text.includes('planifi') || text.includes('inscrit')) return 'session'
  return 'other'
}

export function inferDayGroup(time, at) {
  if (at) {
    const d = new Date(at)
    if (!Number.isNaN(d.getTime())) {
      const now = new Date()
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const diffDays = Math.round((startThat - startToday) / 86400000)
      if (diffDays === 0) return 'today'
      if (diffDays === -1) return 'yesterday'
      return 'week'
    }
  }

  const raw = String(time ?? '').trim()
  if (/^\d{1,2}:\d{2}$/.test(raw)) return 'today'
  if (/^(hier|yesterday|ontem)$/i.test(raw)) return 'yesterday'
  return 'week'
}

export function resolveWeekBucket(log) {
  if (log.weekKey === 'this_week' || log.weekKey === 'last_week') return log.weekKey

  if (log.at) {
    const at = new Date(log.at)
    if (!Number.isNaN(at.getTime())) {
      const now = new Date()
      const thisWeekStart = startOfWeekMonday(now)
      const lastWeekStart = new Date(thisWeekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)

      if (at >= thisWeekStart) return 'this_week'
      if (at >= lastWeekStart) return 'last_week'
      return 'older'
    }
  }

  return 'this_week'
}

export function inferBrandFromText(text) {
  const lower = String(text ?? '').toLowerCase()
  for (const [hint, id] of BRAND_TEXT_HINTS) {
    if (lower.includes(hint)) return id
  }
  return null
}

export function extractScoreFromText(text) {
  const match = String(text ?? '').match(/(?:score\s*)?(\d{1,3})\s*%/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isNaN(n) ? null : n
}

export function enrichActivityLog(log) {
  const brandId = log.brand ?? inferBrandFromText(log.summary ?? log.text)
  const brandDef = brandId ? TEAM_BRAND_DEFS[brandId] : null
  const score = log.score ?? extractScoreFromText(log.summary ?? log.text)
  const scoreTier = score != null ? evalScoreTier(score) : null
  const dayKey = log.dayGroup ?? inferDayGroup(log.time, log.at)

  return {
    ...log,
    type: inferActivityType(log),
    dayKey,
    weekKey: dayKey === 'today' || dayKey === 'yesterday' ? null : resolveWeekBucket(log),
    brandId,
    brandLabel: brandDef?.label ?? null,
    brandLogo: brandDef?.logo ?? null,
    score,
    scoreTier,
    scoreTierClass: evalScoreTierClass(scoreTier),
    summary: log.summary ?? log.text ?? '',
  }
}

/**
 * Aujourd'hui / Hier en entier ; semaines limitées (cette semaine + semaine dernière, max N cartes).
 */
export function partitionActivityFeed(logs, { maxPerWeekGroup = MAX_ACTIVITY_WEEK_GROUP } = {}) {
  const today = []
  const yesterday = []
  const weekBuckets = Object.fromEntries(ACTIVITY_WEEK_GROUPS.map(k => [k, []]))

  for (const log of logs ?? []) {
    const item = enrichActivityLog(log)
    if (item.dayKey === 'today') {
      today.push(item)
      continue
    }
    if (item.dayKey === 'yesterday') {
      yesterday.push(item)
      continue
    }

    const weekKey = item.weekKey ?? resolveWeekBucket(item)
    if (weekKey === 'older' || !weekBuckets[weekKey]) continue
    weekBuckets[weekKey].push(item)
  }

  const weekGroups = ACTIVITY_WEEK_GROUPS
    .filter(key => weekBuckets[key].length)
    .map(weekKey => {
      const all = weekBuckets[weekKey]
      return {
        weekKey,
        items: all.slice(0, maxPerWeekGroup),
        hiddenCount: Math.max(0, all.length - maxPerWeekGroup),
      }
    })

  return { today, yesterday, weekGroups }
}

/** @deprecated Utiliser partitionActivityFeed */
export function groupActivityLogs(logs) {
  const { today, yesterday, weekGroups } = partitionActivityFeed(logs)
  const groups = []
  if (today.length) groups.push({ dayKey: 'today', items: today })
  if (yesterday.length) groups.push({ dayKey: 'yesterday', items: yesterday })
  for (const g of weekGroups) {
    groups.push({ dayKey: 'week', items: g.items })
  }
  return groups
}
