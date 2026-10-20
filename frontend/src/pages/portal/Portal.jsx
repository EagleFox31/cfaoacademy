import { Navigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHashScroll from '../../hooks/usePortalHashScroll'
import LearnerDashboard from './LearnerDashboard'
import KIDashboard from './KIDashboard'
import ManagerDashboard from './ManagerDashboard'
import BranchHRDashboard from './BranchHRDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'
import DpsDashboard from './DpsDashboard'

import { getPrimaryRole, resolveProfile } from './portalProfiles.js'

export { getPrimaryRole }

function resolveView(roles) {
  const profile = resolveProfile(roles)
  if (profile.redirectTo) return <Navigate to={profile.redirectTo} replace />
  if (profile.key === 'superadmin') return <SuperAdminDashboard />
  if (profile.key === 'dps') return <DpsDashboard />
  if (profile.key === 'branch_hr') return <BranchHRDashboard />
  if (profile.key === 'workshop_manager') return <ManagerDashboard />
  if (profile.key === 'team_manager') return <ManagerDashboard />
  if (profile.key === 'ki') return <KIDashboard />
  return <LearnerDashboard />
}

export default function Portal() {
  const { user, status } = useAuth()
  usePortalBackground(user)
  usePortalHashScroll(true)

  // Ne pas rediriger tant que la résolution /me est en cours : sinon un F5
  // envoie vers /login le temps que le back réponde, puis le portail réapparaît
  // au refresh suivant quand la session est déjà en cache.
  if (status === 'loading') return null
  if (!user) return <Navigate to="/login" replace />

  return resolveView(user.roles)
}
