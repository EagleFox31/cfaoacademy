import { buildPortalOnboardingSteps } from '../../utils/portalOnboarding.js'
import { resolvePortalOnboardingRole } from '../../utils/portalOnboarding.js'
import { resolveSectionTourKey } from '../context/routes.js'

/** Identifiants des parcours — le moteur existant reste dans portalOnboarding.js */
export const HELP_TOUR_IDS = {
  portalFull: 'portal-full',
}

/**
 * Registre des tours disponibles pour le centre d'aide.
 * `portal-full` réutilise PortalOnboardingTour via callback — pas de duplication des étapes.
 */
export function listHelpTours(user, portalCopy) {
  if (!user) return []

  const role = resolvePortalOnboardingRole(user)
  const steps = role && portalCopy ? buildPortalOnboardingSteps(user, portalCopy) : []

  const tours = []

  if (steps.length > 0) {
    tours.push({
      id: HELP_TOUR_IDS.portalFull,
      kind: 'existing-onboarding',
      stepCount: steps.length,
      roles: role ? [role] : ['*'],
    })
  }

  return tours
}

export function getHelpTourMeta(tourId) {
  if (tourId === HELP_TOUR_IDS.portalFull) {
    return {
      id: tourId,
      kind: 'existing-onboarding',
      usesExistingEngine: true,
    }
  }
  return null
}

export function resolveMicroTourForContext(contextKey) {
  const sectionKey = resolveSectionTourKey(contextKey)
  if (!sectionKey) return null
  return {
    id: sectionKey,
    kind: 'micro-tour',
    status: 'planned',
    contextKey,
  }
}
