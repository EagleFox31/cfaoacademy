import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import { centreSeul, pageCentreAutorisee } from '../utils/planningAccess.js'

/**
 * Un compte du centre de formation sans autre rôle de portail n'a que sa
 * vitrine (/portail) et la clé de répartition : toute autre page du portail
 * le ramène sur sa vitrine.
 */
export default function GardeCentre({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const dansPortail = pathname === '/portail' || pathname.startsWith('/portail/')
  if (user && dansPortail && !pageCentreAutorisee(pathname) && centreSeul(user.roles)) {
    return <Navigate to="/portail" replace />
  }
  return children
}
