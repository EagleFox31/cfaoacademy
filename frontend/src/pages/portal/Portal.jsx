import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHashScroll from '../../hooks/usePortalHashScroll'
import PortalLoader from '../../components/PortalLoader'
import LearnerDashboard from './LearnerDashboard'
import KIDashboard from './KIDashboard'
import TeamManagerDashboard from './TeamManagerDashboard'
import BranchHRDashboard from './BranchHRDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'
import DpsDashboard from './DpsDashboard'
import TrainerHome from './TrainerHome'
import RHHome from './RHHome'

import { getPrimaryRole, resolveProfile } from './portalProfiles.js'

export { getPrimaryRole }

function resolveView(roles = []) {
  const profile = resolveProfile(roles)
  if (profile.redirectTo) return <Navigate to={profile.redirectTo} replace />
  if (profile.key === 'superadmin') return <SuperAdminDashboard />
  if (profile.key === 'group_hr') return <RHHome />
  if (profile.key === 'dps') return <DpsDashboard />
  if (profile.key === 'branch_hr') return <BranchHRDashboard />
  if (profile.key === 'workshop_manager') return <TeamManagerDashboard mode="workshop" />
  if (profile.key === 'team_manager') return <TeamManagerDashboard mode="team" />
  if (profile.key === 'ki') return <KIDashboard />
  if (roles.includes('trainer')) return <TrainerHome />
  return <LearnerDashboard />
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

  return (
    <>
      {phase !== 'done' && <PortalLoader leaving={phase === 'leaving'} />}
      {phase === 'done' && resolveView(user.roles)}
    </>
  )
}
