import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import PortalOnboardingTour from '../components/PortalOnboardingTour.jsx'
import {
  buildPortalOnboardingSteps,
  markOnboardingComplete,
  resolvePortalOnboardingRole,
} from '../utils/portalOnboarding.js'

const PortalOnboardingContext = createContext({
  startTour: () => {},
  hasTour: false,
  isActive: false,
})

export function usePortalOnboarding() {
  return useContext(PortalOnboardingContext)
}

export function PortalOnboardingProvider({ user, children }) {
  const { t } = useLocale('portal')
  const role = resolvePortalOnboardingRole(user)
  const steps = useMemo(
    () => (user && role ? buildPortalOnboardingSteps(user, t) : []),
    [user, role, t],
  )
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const hasTour = steps.length > 0

  const startTour = useCallback(() => {
    if (!hasTour) return
    setStepIndex(0)
    setActive(true)
  }, [hasTour])

  const closeTour = useCallback((completed = false) => {
    if (completed && user?.sub && role) {
      markOnboardingComplete(user.sub, role)
    }
    setActive(false)
    setStepIndex(0)
  }, [user?.sub, role])

  const value = useMemo(() => ({
    startTour,
    hasTour,
    isActive: active,
  }), [startTour, hasTour, active])

  return (
    <PortalOnboardingContext.Provider value={value}>
      {children}
      {active && hasTour ? (
        <PortalOnboardingTour
          steps={steps}
          stepIndex={stepIndex}
          onStepIndexChange={setStepIndex}
          onClose={closeTour}
          t={t}
        />
      ) : null}
    </PortalOnboardingContext.Provider>
  )
}
