import { Navigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import usePortalHashScroll from '../../hooks/usePortalHashScroll'
import LearnerDashboard from './LearnerDashboard'
import KIDashboard from './KIDashboard'
import TeamManagerDashboard from './TeamManagerDashboard'
import BranchHRDashboard from './BranchHRDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'
import DpsDashboard from './DpsDashboard'

const ROLE_PRIORITY = [
  'superadmin', 'build_team', 'group_admin', 'dps', 'dop', 'branch_hr', 'branch_admin',
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
  if (primary === 'dps' || primary === 'dop') return <DpsDashboard />
  if (primary === 'branch_hr' || primary === 'branch_admin') return <BranchHRDashboard />
  if (primary === 'workshop_manager') return <TeamManagerDashboard mode="workshop" />
  if (primary === 'team_manager') return <TeamManagerDashboard mode="team" />
  if (primary === 'ki' || primary === 'pic') return <KIDashboard />
  return <LearnerDashboard />
}

export default function Portal() {
  const { user } = useAuth()
  usePortalBackground(user)
  usePortalHashScroll(true)

  if (!user) return <Navigate to="/login" replace />

  return resolveView(user.roles)
}
