import { useEffect, useMemo, useState } from 'react'
import { isMedacapEnabled, resolveMedacapUserQuery } from '../utils/medacapConfig.js'
import {
  mergeDpsScopeWithMock,
  resolveDpsFilialeBrandIds,
  sanitizeCollaboratorEvaluations,
} from '../utils/dpsScope.js'
import { mergeCmrEquipmentPlanningSummary } from '../data/dps/cmrEquipmentPlanning.js'
import { hasDpsCompetencyDisplayData, readDpsScopeCache, writeDpsScopeCache } from '../utils/dpsScopeSessionCache.js'
import {
  fetchDpsInsights,
  fetchDpsPif,
  fetchDpsScope,
  mergeScopePayload,
  resolveInsightsTimestamp,
} from '../utils/medacapDpsScopeApi.js'

/** Au-delà : on coupe le badge « Mise à jour… » même si une requête traîne encore. */
const INSIGHTS_UI_SOFT_MS = 3_000

export default function useDpsFilialeScope(user, mockLms) {
  const scopeQuery = useMemo(
    () => resolveMedacapUserQuery(user),
    [user?.medacapUserId, user?.medacapUsername, user?.medacapEmail],
  )
  const needsScopeFetch = isMedacapEnabled() && Boolean(scopeQuery)
  const [scope, setScope] = useState(null)
  const [scopeLoading, setScopeLoading] = useState(needsScopeFetch)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    let softTimer = 0
    let pendingEnrich = 0

    function clearSoftTimer() {
      if (softTimer) {
        window.clearTimeout(softTimer)
        softTimer = 0
      }
    }

    function finishEnrichIfIdle() {
      if (cancelled || pendingEnrich > 0) return
      clearSoftTimer()
      setInsightsLoading(false)
    }

    /** Cache session si utilisable, sinon null → le LMS tombe sur le mock local. */
    function resolveOfflineScope(prev) {
      if (prev?.brands?.length) {
        const probe = mergeDpsScopeWithMock(prev, mockLms)
        if (hasDpsCompetencyDisplayData(probe)) return prev
      }
      return null
    }

    if (!needsScopeFetch) {
      setScope(null)
      setScopeLoading(false)
      setInsightsLoading(false)
      setLastUpdatedAt(new Date())
      return undefined
    }

    const cached = readDpsScopeCache(user)
    const localReady = hasDpsCompetencyDisplayData(mockLms)
      || (cached?.scope && hasDpsCompetencyDisplayData(
        mergeDpsScopeWithMock(cached.scope, mockLms),
      ))

    if (cached?.scope) {
      setScope({
        ...cached.scope,
        collaboratorEvaluations: sanitizeCollaboratorEvaluations(cached.scope.collaboratorEvaluations),
      })
      setScopeLoading(false)
      setInsightsLoading(true)
      if (cached.cachedAt) setLastUpdatedAt(new Date(cached.cachedAt))
    } else if (localReady) {
      /* Local-first : mock affiché tout de suite, refresh réseau en fond. */
      setScope(null)
      setScopeLoading(false)
      setInsightsLoading(true)
    } else {
      setScopeLoading(true)
      setInsightsLoading(false)
      setScope(null)
    }

    if (localReady) {
      softTimer = window.setTimeout(() => {
        if (!cancelled) setInsightsLoading(false)
      }, INSIGHTS_UI_SOFT_MS)
    }

    ;(async () => {
      const fast = await fetchDpsScope(scopeQuery, { insights: false, pif: false })
      if (cancelled) return

      /* BD en ligne indispo / timeout / erreur → rester sur cache ou mock local. */
      if (!fast?.brands?.length) {
        setScope(resolveOfflineScope)
        setScopeLoading(false)
        setInsightsLoading(false)
        clearSoftTimer()
        return
      }

      setScope(prev => ({
        ...(prev ?? {}),
        ...fast,
        brandStats: prev?.brandStats?.length ? prev.brandStats : (fast.brandStats ?? []),
        collaboratorEvaluations: prev?.collaboratorEvaluations?.length
          ? prev.collaboratorEvaluations
          : [],
      }))
      setScopeLoading(false)
      setInsightsLoading(true)

      clearSoftTimer()
      softTimer = window.setTimeout(() => {
        if (!cancelled) setInsightsLoading(false)
      }, INSIGHTS_UI_SOFT_MS)

      pendingEnrich = 2

      const applyInsights = async () => {
        try {
          const insights = await fetchDpsInsights(scopeQuery)
          if (cancelled || !insights) return
          setScope(prev => {
            const merged = mergeScopePayload(prev, insights, null)
            if (merged) writeDpsScopeCache(user, merged)
            return merged
          })
          const computedAt = resolveInsightsTimestamp(insights)
          if (computedAt) setLastUpdatedAt(computedAt)
        } finally {
          pendingEnrich -= 1
          finishEnrichIfIdle()
        }
      }

      const applyPif = async () => {
        try {
          const pif = await fetchDpsPif(scopeQuery)
          if (cancelled || !pif) return
          setScope(prev => {
            const merged = mergeScopePayload(prev, null, pif)
            if (merged) writeDpsScopeCache(user, merged)
            return merged
          })
        } finally {
          pendingEnrich -= 1
          finishEnrichIfIdle()
        }
      }

      await Promise.all([applyInsights(), applyPif()])
    })()

    return () => {
      cancelled = true
      clearSoftTimer()
    }
  }, [user?.sub, needsScopeFetch, mockLms, scopeQuery])

  const lms = useMemo(
    () => {
      /* scope null = fallback mock local (BD offline ou pas encore de live). */
      const merged = scope ? mergeDpsScopeWithMock(scope, mockLms) : mockLms
      return mergeCmrEquipmentPlanningSummary(merged, mockLms)
    },
    [scope, mockLms],
  )

  const filialeBrandIds = useMemo(
    () => resolveDpsFilialeBrandIds(lms),
    [lms],
  )

  const displayUser = useMemo(() => {
    if (!filialeBrandIds.length) return user
    return { ...user, brands: filialeBrandIds }
  }, [user, filialeBrandIds])

  return {
    lms,
    displayUser,
    filialeBrands: lms?.brandStats ?? [],
    scopeLoading,
    insightsLoading,
    lastUpdatedAt,
  }
}
