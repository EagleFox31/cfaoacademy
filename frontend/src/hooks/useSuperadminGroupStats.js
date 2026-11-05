import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'

const VALID_BUS = new Set(['all', 'equipment', 'motors'])

/**
 * Hook — appelle GET /api/v1/core/analytics/group-stats[?bu=…] et retourne les
 * KPIs groupe consolidés depuis Mongo MEDACAP + cfao-needs :
 *   { bu, learnerCount, branchCount, brandCount, trainingCount, trainingYear,
 *     loading, error }
 *
 * Actif uniquement pour le super admin. Passe par le helper `api` du repo qui
 * gère JWT (`session.accessToken`), silent refresh et retry 401 — au lieu de
 * lire `sessionStorage` à la main.
 *
 * @param {object} user — utilisateur authentifié (useAuth)
 * @param {object} [opts]
 * @param {'all'|'equipment'|'motors'} [opts.bu='all'] — filtre BU. Change ⇒ refetch.
 *
 * Fail-open : si l'endpoint tombe (Mongo indispo, Cerbos deny, réseau), on
 * renvoie `null` et le hero affichera un tiret plutôt qu'un chiffre bidon.
 */
export default function useSuperadminGroupStats(user, { bu = 'all' } = {}) {
  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes('superadmin')
  const normalizedBu = VALID_BUS.has(bu) ? bu : 'all'
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(isSuperAdmin)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isSuperAdmin) {
      setStats(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api.groupStats(normalizedBu)
      .then(data => {
        if (cancelled) return
        setStats({
          bu:            data?.bu ?? normalizedBu,
          learnerCount:  Number(data?.learnerCount)  || 0,
          branchCount:   Number(data?.branchCount)   || 0,
          brandCount:    Number(data?.brandCount)    || 0,
          trainingCount: Number(data?.trainingCount) || 0,
          trainingYear:  Number(data?.trainingYear)  || new Date().getFullYear(),
          // Breakdown par filiale (indépendant de bu — l'API renvoie les 3 colonnes).
          filiales:      Array.isArray(data?.filiales) ? data.filiales : [],
          // Places allouées par pays pour `trainingYear` (Item 4, source cfao-needs).
          allocationsPerBranch: Array.isArray(data?.allocationsPerBranch) ? data.allocationsPerBranch : [],
        })
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        setError(e instanceof ApiError ? { status: e.status, message: e.message } : { message: String(e) })
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [isSuperAdmin, user?.sub, normalizedBu])

  return { stats, loading, error }
}
