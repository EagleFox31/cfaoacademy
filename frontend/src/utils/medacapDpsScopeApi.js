import { isMedacapEnabled, medacapApiUrl } from './medacapConfig.js'
import { sanitizeCollaboratorEvaluations } from './dpsScope.js'

/** Délai max avant abort — calibré pour le calcul complet des GF filiale (~5-7s) sans timeout prématuré. */
export const DPS_SCOPE_FETCH_MS = 6_000
export const DPS_INSIGHTS_FETCH_MS = 20_000
export const DPS_PIF_FETCH_MS = 10_000

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { credentials: 'omit', signal: controller.signal })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchDpsScope(query, { insights = true, pif = true } = {}) {
  if (!query || !isMedacapEnabled()) return null

  const url = medacapApiUrl('dps-scope.php', {
    ...query,
    insights: insights ? '1' : '0',
    pif: pif ? '1' : '0',
  })
  return fetchJsonWithTimeout(url, DPS_SCOPE_FETCH_MS)
}

export async function fetchDpsInsights(query) {
  if (!query || !isMedacapEnabled()) return null

  const url = medacapApiUrl('dps-insights.php', query)
  return fetchJsonWithTimeout(url, DPS_INSIGHTS_FETCH_MS)
}

export async function fetchDpsPif(query) {
  if (!query || !isMedacapEnabled()) return null

  const url = medacapApiUrl('dps-pif.php', query)
  return fetchJsonWithTimeout(url, DPS_PIF_FETCH_MS)
}

export function mergeScopePayload(scope, insights, pif) {
  if (!scope) return null
  const collaboratorEvaluations = insights?.collaboratorEvaluations != null
    ? sanitizeCollaboratorEvaluations(insights.collaboratorEvaluations)
    : sanitizeCollaboratorEvaluations(scope.collaboratorEvaluations ?? [])
  return {
    ...scope,
    brandStats: insights?.brandStats ?? scope.brandStats ?? [],
    collaboratorEvaluations,
    recentLogs: insights?.recentLogs ?? scope.recentLogs ?? [],
    insightsComputedAt: insights?.computedAt ?? scope.insightsComputedAt ?? null,
    insightsSource: insights?.source ?? scope.insightsSource ?? null,
    planningStatus: pif?.planningStatus ?? scope.planningStatus ?? {},
    brandPifStats: pif?.brandPifStats ?? scope.brandPifStats ?? [],
    brandPlanningSummary: pif?.brandPlanningSummary ?? scope.brandPlanningSummary ?? {},
    pifTechnicians: (pif?.pifTechnicians?.length
      ? pif.pifTechnicians
      : (scope.pifTechnicians ?? [])),
  }
}

export function resolveInsightsTimestamp(insights) {
  if (!insights?.computedAt) return null
  const parsed = new Date(insights.computedAt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
