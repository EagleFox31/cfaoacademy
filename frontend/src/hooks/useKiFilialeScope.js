import { useEffect, useMemo, useState } from 'react'
import { isMedacapEnabled } from '../utils/medacapConfig.js'
import { buildLmsFromDpsScope, sanitizeCollaboratorEvaluations } from '../utils/dpsScope.js'
import {
  fetchDpsInsights,
  fetchDpsPif,
  fetchDpsScope,
  mergeScopePayload,
  resolveInsightsTimestamp,
} from '../utils/medacapDpsScopeApi.js'
import {
  filterLmsToInstructorBrand,
  resolveKiInstructorBrand,
  resolveKiMedacapQuery,
} from '../utils/kiScope.js'
import { readDpsScopeCache, writeDpsScopeCache } from '../utils/dpsScopeSessionCache.js'

function userForScopeCache(user) {
  const query = resolveKiMedacapQuery(user)
  if (!query) return user
  return {
    ...user,
    medacapUserId: query.userId ?? user.medacapUserId,
    medacapUsername: query.username ?? user.medacapUsername,
    medacapEmail: query.email ?? user.medacapEmail,
  }
}

/** Scope filiale instructeur (KI/PIC) — API MEDACAP uniquement, sans mock local. */
export default function useKiFilialeScope(user) {
  /* Memoise : resolveKiMedacapQuery() renvoie un objet neuf a chaque appel, et
     scopeQuery figure dans les deps de l'effet plus bas. Sans cela l'effet se
     relance a chaque rendu, son cleanup annule la requete en vol (donc son
     .finally() ne leve plus scopeLoading) et le squelette reste fige. */
  const scopeQuery = useMemo(() => resolveKiMedacapQuery(user), [user])
  const needsScopeFetch = isMedacapEnabled() && Boolean(scopeQuery)
  const cacheUser = useMemo(() => userForScopeCache(user), [user])
  const instructorBrand = resolveKiInstructorBrand(user, null)

  const [scope, setScope] = useState(null)
  const [scopeLoading, setScopeLoading] = useState(needsScopeFetch)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false

    if (!needsScopeFetch) {
      setScope(null)
      setScopeLoading(false)
      setInsightsLoading(false)
      setLastUpdatedAt(new Date())
      return undefined
    }

    const cached = readDpsScopeCache(cacheUser)
    if (cached?.scope) {
      setScope({
        ...cached.scope,
        collaboratorEvaluations: sanitizeCollaboratorEvaluations(cached.scope.collaboratorEvaluations),
      })
      setScopeLoading(false)
      setInsightsLoading(true)
      if (cached.cachedAt) setLastUpdatedAt(new Date(cached.cachedAt))
    } else {
      setScopeLoading(true)
      setInsightsLoading(false)
      setScope(null)
    }

    fetchDpsScope(scopeQuery, { insights: false, pif: false })
      .then(fast => {
        if (cancelled) return null
        if (!fast?.brands) {
          setScope(prev => (prev?.brands?.length ? prev : null))
          setScopeLoading(false)
          setInsightsLoading(false)
          return null
        }
        setScope(prev => ({
          ...(prev ?? {}),
          ...fast,
          brandStats: prev?.brandStats?.length ? prev.brandStats : (fast.brandStats ?? []),
          collaboratorEvaluations: [],
        }))
        setScopeLoading(false)
        setInsightsLoading(true)
        return Promise.all([
          fetchDpsInsights(scopeQuery),
          fetchDpsPif(scopeQuery),
        ])
      })
      .then(result => {
        if (cancelled || !result) return
        const [insights, pif] = result
        setScope(prev => {
          const merged = mergeScopePayload(prev, insights, pif)
          if (merged) writeDpsScopeCache(cacheUser, merged)
          return merged
        })
        const computedAt = resolveInsightsTimestamp(insights)
        if (computedAt) setLastUpdatedAt(computedAt)
      })
      .catch(() => {
        if (cancelled) return
        setScope(prev => (prev?.brands?.length ? prev : null))
      })
      .finally(() => {
        if (!cancelled) {
          setScopeLoading(false)
          setInsightsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [user, needsScopeFetch, scopeQuery, cacheUser])

  const filialeLms = useMemo(() => {
    const built = scope ? buildLmsFromDpsScope(scope) : null
    if (!built) return null
    return filterLmsToInstructorBrand(built, instructorBrand)
  }, [scope, instructorBrand])

  return {
    filialeLms,
    scopeLoading,
    insightsLoading,
    lastUpdatedAt,
    medacapLinked: Boolean(scopeQuery),
  }
}
