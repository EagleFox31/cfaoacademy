import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import { cleSeule, PLANNING_HOME } from '../utils/planningAccess.js'

/** Ramène sur la clé de répartition un compte qui n'a accès à rien d'autre dans le portail. */
export default function GardeCleSeule({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const dansPortail = pathname === '/portail' || pathname.startsWith('/portail/')
  const surLaCle = pathname === PLANNING_HOME || pathname.startsWith(`${PLANNING_HOME}/`)
  if (user && dansPortail && !surLaCle && cleSeule(user.roles)) {
    return <Navigate to={PLANNING_HOME} replace />
  }
  return children
}
