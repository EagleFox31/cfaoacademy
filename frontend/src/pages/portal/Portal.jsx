import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import PortalLoader from '../../components/PortalLoader'
import LearnerDashboard from './LearnerDashboard'
import KIDashboard from './KIDashboard'
import TeamManagerDashboard from './TeamManagerDashboard'
import BranchHRDashboard from './BranchHRDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'
import TrainerHome from './TrainerHome'

const ROLE_PRIORITY = [
  'superadmin', 'build_team', 'group_admin', 'branch_hr', 'branch_admin',
  'workshop_manager', 'team_manager',
  'ki', 'pic',
  'trainer', 'center_director',
]

export function getPrimaryRole(roles) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return 'learner'
}

function resolveView(roles) {
  const primary = getPrimaryRole(roles)
  if (primary === 'build_team') return <Navigate to="/portail/delivery" replace />
  if (primary === 'group_admin') return <Navigate to="/portail/delivery" replace />
  if (primary === 'superadmin') return <SuperAdminDashboard />
  if (primary === 'branch_hr' || primary === 'branch_admin') return <BranchHRDashboard />
  if (primary === 'workshop_manager') return <TeamManagerDashboard mode="workshop" />
  if (primary === 'team_manager') return <TeamManagerDashboard mode="team" />
  if (primary === 'ki' || primary === 'pic') return <KIDashboard />
  if (primary === 'trainer') return <TrainerHome />
  return <LearnerDashboard />
}

// Compte pour lequel l'écran de chargement a déjà été joué dans ce chargement de
// page : il ne revient qu'au rafraîchissement ou à une nouvelle connexion, pas à
// une simple navigation.
let dejaAccueilli = null

export default function Portal() {
  const { user } = useAuth()
  usePortalBackground(user)
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
