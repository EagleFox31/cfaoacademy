import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHashScroll from '../../hooks/usePortalHashScroll'
import PortalLoader from '../../components/PortalLoader'

import { getPrimaryRole, resolveProfile } from './portalProfiles.js'

export { getPrimaryRole }

// Un seul tableau de bord s'affiche : seul celui du rôle connecté est téléchargé,
// et son téléchargement démarre pendant l'écran de chargement.
const VUES = {
  superadmin: () => import('./SuperAdminDashboard'),
  consultation: () => import('./RHHome'),
  dps: () => import('./DpsDashboard'),
  team: () => import('./TeamManagerDashboard'),
  ki: () => import('./KIDashboard'),
  trainer: () => import('./TrainerHome'),
  center: () => import('./CenterHome'),
  learner: () => import('./LearnerDashboard'),
}
const COMPOSANTS = Object.fromEntries(Object.entries(VUES).map(([k, charger]) => [k, lazy(charger)]))

export function resolveView(roles = []) {
  const profile = resolveProfile(roles)
  if (profile.redirectTo) return { redirect: profile.redirectTo }
  if (profile.key === 'workshop_manager') return { vue: 'team', props: { mode: 'workshop' } }
  if (profile.key === 'team_manager') return { vue: 'team', props: { mode: 'team' } }
  if (['group', 'direction', 'branch_hr'].includes(profile.key)) return { vue: 'consultation', props: { mode: profile.mode } }
  if (['superadmin', 'dps', 'ki'].includes(profile.key)) return { vue: profile.key }
  if (roles.includes('trainer')) return { vue: 'trainer' }
  if (profile.key === 'center') return { vue: 'center', props: { mode: profile.mode } }
  return { vue: 'learner' }
}

// Compte pour lequel l'écran de chargement a déjà été joué dans ce chargement de
// page : il ne revient qu'au rafraîchissement ou à une nouvelle connexion, pas à
// une simple navigation.
let dejaAccueilli = null

export default function Portal() {
  const { user } = useAuth()
  usePortalBackground(user)
  usePortalHashScroll(true)
  const cle = user && (user.compte || user.id || user.email || user.name)
  // 'loading' → 'leaving' (fondu) → 'done' (dashboard monté, animations d'entrée jouées)
  const [phase, setPhase] = useState(() => (cle && cle === dejaAccueilli ? 'done' : 'loading'))
  const vue = user ? resolveView(user.roles) : null

  useEffect(() => {
    if (vue?.vue) VUES[vue.vue]()  // préchargement pendant l'écran de chargement
  }, [vue?.vue])

  useEffect(() => {
    if (phase === 'done') return undefined
    dejaAccueilli = cle
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const hold = reduce ? 150 : 850
    const t1 = setTimeout(() => setPhase('leaving'), hold)
    const t2 = setTimeout(() => setPhase('done'), hold + 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!user) return <Navigate to="/login" replace />
  if (vue.redirect) return <Navigate to={vue.redirect} replace />

  const Vue = COMPOSANTS[vue.vue]
  return (
    <>
      {phase !== 'done' && <PortalLoader leaving={phase === 'leaving'} />}
      {phase === 'done' && (
        <Suspense fallback={<PortalLoader />}>
          <Vue {...vue.props} />
        </Suspense>
      )}
    </>
  )
}
