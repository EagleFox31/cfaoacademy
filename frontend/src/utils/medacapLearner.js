import { isPlMedacapVariant } from './portalVariant.js'

/** Apprenant relié à un compte technicien MEDACAP (pas une démo purement mock). */
export function isMedacapLearner(user) {
  return Boolean(user?.medacapUsername || user?.medacapUserId)
}

function levelToCertKey(level) {
  if (!level) return null
  return String(level).toUpperCase().trim()
}

/** Profil affiché : mock minimal + données Mongo renvoyées par l’API. */
export function resolveMedacapLearnerUser(user, medacapProfile) {
  if (!isMedacapLearner(user) || !medacapProfile) return user

  const brands = medacapProfile.brands?.length ? medacapProfile.brands : user.brands
  const certKey = levelToCertKey(medacapProfile.level)
  const certLevels = certKey && brands?.length
    ? Object.fromEntries(brands.map(b => [b, certKey]))
    : user.certLevels

  return {
    ...user,
    firstName: medacapProfile.firstName ?? user.firstName,
    lastName: medacapProfile.lastName ?? user.lastName,
    filiale: medacapProfile.subsidiary ?? user.filiale,
    orgLabel: medacapProfile.agency ?? user.orgLabel,
    pays: medacapProfile.country ?? user.pays,
    brands,
    certLevels,
    medacapUserId: medacapProfile.medacapUserId ?? user.medacapUserId,
  }
}

/**
 * Fusion évaluations :
 * - learner MEDACAP avec données live → compétences 100 % API + formations mock
 * - variante PL-MEDACAP sans données live → mock complet (démo autonome hors-API)
 * - learner MEDACAP standard sans données live → formations mock uniquement (inchangé)
 * - autres profils démo → mock inchangé
 *
 * `lms` sert uniquement à détecter la variante PL-MEDACAP pour le repli démo.
 */
export function mergeMedacapLearnerEvaluations(mockEvaluations = [], medacapCompetency = [], user, lms = null) {
  if (!isMedacapLearner(user)) {
    return mockEvaluations
  }

  if (medacapCompetency.length) {
    const formations = mockEvaluations.filter(e => e.kind === 'formation')
    return [...medacapCompetency, ...formations]
  }

  // Pas de réponse API : la variante PL-MEDACAP garde le mock complet (démo).
  if (isPlMedacapVariant(lms)) {
    return mockEvaluations
  }

  return mockEvaluations.filter(e => e.kind === 'formation')
}

/** Sections encore mockées pour un learner MEDACAP (branchement progressif). */
export function medacapLearnerSections(lms) {
  const hasPlanPathway = (lms?.planPathway?.length ?? 0) > 0
  const hasCerts = (lms?.certifications?.length ?? 0) > 0
  const hasDiscover = (lms?.discover?.length ?? 0) > 0

  // Variante PL-MEDACAP : le PIF est un plan post-diagnostic alimenté par
  // `assignedTrainings` / `planningStatus`, pas seulement par `planPathway`.
  // Le conditionner à `planPathway` masquait la section alors que la navbar
  // proposait toujours l'entrée « Votre PIF ».
  const pif = hasPlanPathway || isPlMedacapVariant(lms)

  return {
    pif,
    certifications: hasCerts,
    discover: hasDiscover,
    formationTests: hasPlanPathway,
  }
}
