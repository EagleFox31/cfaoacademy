import { useEffect, useMemo, useState } from 'react'
import { isMedacapEnabled, resolveMedacapUserQuery } from '../utils/medacapConfig.js'
import {
  buildLmsFromDpsScope,
  emptyDpsLms,
  resolveDpsFilialeBrandIds,
  sanitizeCollaboratorEvaluations,
} from '../utils/dpsScope.js'
import { applyCmrEquipmentPifFallback } from '../data/dps/cmrEquipmentPlanning.js'
import { readDpsScopeCache, writeDpsScopeCache } from '../utils/dpsScopeSessionCache.js'
import {
  fetchDpsInsights,
  fetchDpsPif,
  fetchDpsScope,
  mergeScopePayload,
  resolveInsightsTimestamp,
} from '../utils/medacapDpsScopeApi.js'

/** Au-delà : on coupe le badge « Mise à jour… » même si une requête traîne encore. */
const INSIGHTS_UI_SOFT_MS = 3_000

/**
 * LMS du portail DPS à partir du seul live MEDACAP (ou de son cache de session).
 * Sans live : LMS vide, les vues affichent « — ». Le PIF tombe sur l'extraction
 * locale CMR seulement si dps-pif.php n'a pas répondu.
 * `pageLms` ne sert qu'aux blocs hors compétences (alertes, tickets d'assistance).
 */
export function resolveDpsLms(scope, pifStatus, pageLms) {
  const live = scope ? buildLmsFromDpsScope(scope) : null
  const base = {
    ...(live ?? emptyDpsLms()),
    alerts: pageLms?.alerts ?? [],
    filialeTickets: pageLms?.filialeTickets ?? [],
  }
  return pifStatus === 'failed' ? applyCmrEquipmentPifFallback(base) : base
}

export default function useDpsFilialeScope(user, pageLms) {
  const scopeQuery = useMemo(
    () => resolveMedacapUserQuery(user),
    [user?.medacapUserId, user?.medacapUsername, user?.medacapEmail],
  )
  const needsScopeFetch = isMedacapEnabled() && Boolean(scopeQuery)
  const [scope, setScope] = useState(null)
  const [scopeLoading, setScopeLoading] = useState(needsScopeFetch)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [pifStatus, setPifStatus] = useState(needsScopeFetch ? 'pending' : 'failed')
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

    const keepLivePif = status => (status === 'live' ? status : 'failed')

    if (!needsScopeFetch) {
      setScope(null)
      setScopeLoading(false)
      setInsightsLoading(false)
      setPifStatus('failed')
      setLastUpdatedAt(new Date())
      return undefined
    }

    const cached = readDpsScopeCache(user)

    if (cached?.scope) {
      setScope({
        ...cached.scope,
        collaboratorEvaluations: sanitizeCollaboratorEvaluations(cached.scope.collaboratorEvaluations),
      })
      setScopeLoading(false)
      setInsightsLoading(true)
      setPifStatus(cached.scope.pifLive ? 'live' : 'pending')
      if (cached.cachedAt) setLastUpdatedAt(new Date(cached.cachedAt))
      softTimer = window.setTimeout(() => {
        if (!cancelled) setInsightsLoading(false)
      }, INSIGHTS_UI_SOFT_MS)
    } else {
      setScopeLoading(true)
      setInsightsLoading(false)
      setPifStatus('pending')
      setScope(null)
    }

    ;(async () => {
      const fast = await fetchDpsScope(scopeQuery, { insights: false, pif: false })
      if (cancelled) return

      /* BD en ligne indispo / timeout / erreur → cache de session s'il existe, sinon rien. */
      if (!fast?.brands?.length) {
        setScope(prev => (prev?.brands?.length ? prev : null))
        setScopeLoading(false)
        setInsightsLoading(false)
        setPifStatus(keepLivePif)
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
        let answered = false
        try {
          const pif = await fetchDpsPif(scopeQuery)
          if (cancelled || !pif) return
          answered = true
          setScope(prev => {
            const merged = mergeScopePayload(prev, null, pif)
            if (!merged) return merged
            const withFlag = { ...merged, pifLive: true }
            writeDpsScopeCache(user, withFlag)
            return withFlag
          })
          setPifStatus('live')
        } finally {
          if (!cancelled && !answered) setPifStatus(keepLivePif)
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
  }, [user?.sub, needsScopeFetch, scopeQuery])

  const lms = useMemo(
    () => resolveDpsLms(scope, pifStatus, pageLms),
    [scope, pifStatus, pageLms],
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
    liveUnavailable: !scopeLoading && !scope,
    lastUpdatedAt,
  }
}
