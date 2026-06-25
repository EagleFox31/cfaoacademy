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
 * - learner MEDACAP → compétences 100 % API (todo, progress, done)
 * - autres profils démo → mock inchangé
 */
export function mergeMedacapLearnerEvaluations(mockEvaluations = [], medacapCompetency = [], user) {
  if (!isMedacapLearner(user)) {
    return mockEvaluations
  }

  const formations = mockEvaluations.filter(e => e.kind === 'formation')
  if (medacapCompetency.length) {
    return [...medacapCompetency, ...formations]
  }
  return formations
}

/** Sections encore mockées pour un learner MEDACAP (branchement progressif). */
export function medacapLearnerSections(lms) {
  const hasPif = (lms?.planPathway?.length ?? 0) > 0
  const hasCerts = (lms?.certifications?.length ?? 0) > 0
  const hasDiscover = (lms?.discover?.length ?? 0) > 0

  return {
    pif: hasPif,
    certifications: hasCerts,
    discover: hasDiscover,
    formationTests: hasPif,
  }
}
