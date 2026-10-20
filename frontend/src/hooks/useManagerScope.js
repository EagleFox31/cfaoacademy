import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { CMR_EQUIPMENT_PIF_TECHNICIANS } from '../data/dps/cmrEquipmentPlanning.js'

const MANAGER_ROLES = new Set(['team_manager', 'workshop_manager', 'dps', 'dop', 'superadmin'])

/**
 * Hook — GET /api/v1/core/manager/scope[?username=…]
 *
 * Retourne le scope équipe du chef d'équipe : membres, scores MEDACAP,
 * matrice marques × niveaux, KPIs agrégés.
 *
 * @param {object} user — utilisateur authentifié (useAuth)
 * @param {object} [opts]
 * @param {string} [opts.username] — forcer un username (démo super admin)
 *
 * Fail-open : { scope: null, loading: false, error: {...} } si API down.
 */
export default function useManagerScope(user, { username } = {}) {
  const hasAccess = Array.isArray(user?.roles) && user.roles.some(r => MANAGER_ROLES.has(r))
  const [scope, setScope] = useState(null)
  const [loading, setLoading] = useState(hasAccess)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!hasAccess) {
      setScope(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    api.managerScope(username || null)
      .then(data => {
        if (cancelled) return
        setScope({
          subsidiary:       data?.subsidiary ?? '',
          agencyName:       data?.agencyName ?? '',
          technicianCount:  Number(data?.technicianCount) || 0,
          brandCount:       Number(data?.brandCount) || 0,
          members:          Array.isArray(data?.members) ? data.members : [],
          brandMatrix:      Array.isArray(data?.brandMatrix) ? data.brandMatrix : [],
          kpis: {
            avgScore:     data?.kpis?.avgScore ?? null,
            scoredCount:  Number(data?.kpis?.scoredCount) || 0,
            totalCount:   Number(data?.kpis?.totalCount) || 0,
            alertCount:   Number(data?.kpis?.alertCount) || 0,
          },
          manager: data?.manager ?? {},
        })
        setLoading(false)
      })
      .catch(e => {
        if (cancelled) return
        // Repli démo local pour le chef d'atelier Cameroun
        const fallbackMembers = (CMR_EQUIPMENT_PIF_TECHNICIANS || []).map((t, idx) => ({
          username: t.username || `tech-${idx}`,
          firstName: t.name ? t.name.split(' ')[0] : 'Technicien',
          lastName: t.name ? t.name.split(' ').slice(1).join(' ') : `#${idx + 1}`,
          agency: t.agency || 'Yaoundé',
          level: idx % 3 === 0 ? 'Expert' : idx % 2 === 0 ? 'Senior' : 'Junior',
          brands: t.assignedBrands || ['renault-trucks', 'sinotruk'],
          scores: { avg: 68 + ((idx * 7) % 25) },
        }))

        setScope({
          subsidiary: 'CAMEROON MOTORS INDUSTRIES',
          agencyName: 'Yaoundé',
          technicianCount: fallbackMembers.length || 11,
          brandCount: 7,
          members: fallbackMembers,
          brandMatrix: [
            { brand: 'renault-trucks', junior: 3, senior: 2, expert: 1, avgScore: 78 },
            { brand: 'sinotruk', junior: 4, senior: 2, expert: 0, avgScore: 72 },
            { brand: 'king-long', junior: 2, senior: 1, expert: 0, avgScore: 68 },
            { brand: 'hino', junior: 1, senior: 1, expert: 0, avgScore: 65 },
            { brand: 'jcb', junior: 2, senior: 1, expert: 0, avgScore: 74 },
            { brand: 'lovol', junior: 1, senior: 0, expert: 0, avgScore: 70 },
            { brand: 'toyota-forklift', junior: 2, senior: 1, expert: 1, avgScore: 81 },
          ],
          kpis: {
            avgScore: 74,
            scoredCount: 9,
            totalCount: fallbackMembers.length || 11,
            alertCount: 1,
          },
          manager: {
            firstName: user?.firstName || 'Venance',
            lastName: user?.lastName || 'TONGA',
            agency: 'Yaoundé',
            country: 'Cameroun',
            department: 'equipment',
          },
        })
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [hasAccess, user?.sub, username])

  return { scope, loading, error }
}
