import { useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import { getPortalNavSections } from '../data/index.js'
import { goToPortalQuestion } from '../utils/portalHelp.js'
import { PortalOnboardingProvider, usePortalOnboarding } from '../context/PortalOnboardingContext.jsx'
import { HelpProvider } from './context/HelpProvider.jsx'
import HelpCenterDrawer from './components/HelpCenterDrawer.jsx'
import './styles/help.css'

function PortalHelpIntegration({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { startTour } = usePortalOnboarding()
  const portalSections = useMemo(
    () => (user ? getPortalNavSections(user.roles) : []),
    [user],
  )

  const handleStartFullTour = useCallback(() => {
    const onDashboard = pathname === '/portail' || pathname === '/portail/'
    if (!onDashboard) {
      navigate('/portail')
      window.setTimeout(() => startTour(), 600)
      return
    }
    startTour()
  }, [pathname, navigate, startTour])

  return (
    <HelpProvider
      onStartFullTour={handleStartFullTour}
      onContactExpert={() => goToPortalQuestion({ navigate, pathname, portalSections })}
    >
      {children}
      <HelpCenterDrawer />
    </HelpProvider>
  )
}

/** Enveloppe portail : visite guidée + centre d'aide (drawer). N'active rien hors /portail. */
export default function PortalHelpShell({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const onPortal = pathname.startsWith('/portail')

  if (!onPortal || !user) return children

  return (
    <PortalOnboardingProvider user={user}>
      <PortalHelpIntegration>{children}</PortalHelpIntegration>
    </PortalOnboardingProvider>
  )
}
