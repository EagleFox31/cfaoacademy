const STORAGE_PREFIX = 'cfao:dps-scope:'

/** Incrémenter quand la forme des collaboratorEvaluations change (ex. scores GF par marque). */
export const DPS_SCOPE_CACHE_VERSION = 5

export function resolveDpsScopeCacheKey(user) {
  if (!user) return null
  const id = user.medacapUserId
    || user.medacapUsername
    || user.medacapEmail
    || user.kiScopeMedacapUserId
    || user.kiScopeMedacapUsername
    || user.kiScopeMedacapEmail
    || user.sub
  return id ? `${STORAGE_PREFIX}${id}` : null
}

/** Données affichables sans attendre insights (mock, cache session ou scope partiel). */
export function hasDpsCompetencyDisplayData(lms) {
  if ((lms?.collaboratorEvaluations?.length ?? 0) > 0) return true
  return (lms?.brandStats ?? []).some(
    row => (row.evaluated ?? 0) > 0 || row.avgScore != null,
  )
}

export function readDpsScopeCache(user) {
  const key = resolveDpsScopeCacheKey(user)
  if (!key) return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== DPS_SCOPE_CACHE_VERSION) return null
    if (!parsed?.scope?.brands?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDpsScopeCache(user, scope) {
  const key = resolveDpsScopeCacheKey(user)
  if (!key || !scope?.brands?.length) return
  try {
    sessionStorage.setItem(key, JSON.stringify({
      version: DPS_SCOPE_CACHE_VERSION,
      cachedAt: new Date().toISOString(),
      scope,
    }))
  } catch {
    /* quota / private mode */
  }
}

export function clearDpsScopeCache(user) {
  const key = resolveDpsScopeCacheKey(user)
  if (!key) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
