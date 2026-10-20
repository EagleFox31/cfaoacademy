import { resolveMedacapUserQuery } from './medacapConfig.js'
import { resolveDpsFilialePifTechnicians } from './dpsFilialePifTechnicians.js'

/** Identifiant MEDACAP pour le scope filiale KI (compte personnel ou compte DPS filiale). */
export function resolveKiMedacapQuery(user) {
  if (!user) return null
  const personal = resolveMedacapUserQuery(user)
  if (personal) return personal
  if (user.kiScopeMedacapUserId) return { userId: user.kiScopeMedacapUserId }
  if (user.kiScopeMedacapUsername) return { username: user.kiScopeMedacapUsername }
  if (user.kiScopeMedacapEmail) return { email: user.kiScopeMedacapEmail }
  return null
}

export function resolveKiInstructorBrand(user, lms) {
  const fromUser = user?.instructorBrands?.[0]
  if (fromUser) return fromUser
  return lms?.kiScope?.instructorBrand ?? 'toyota'
}

function rowMatchesBrand(row, brand) {
  const brands = row.brands?.length
    ? row.brands
    : (row.assignedBrands?.length
      ? row.assignedBrands
      : (row.brand ? [row.brand] : []))
  return brands.includes(brand)
}

function evalMatchesBrand(entry, brand) {
  const brands = entry.brands?.length ? entry.brands : (entry.brand ? [entry.brand] : [])
  return brands.includes(brand)
}

/** Restreint le scope filiale à la marque instructeur du KI/PIC. */
export function filterLmsToInstructorBrand(lms, brand) {
  if (!lms || !brand) return lms

  const brandStats = (lms.brandStats ?? []).filter(row => row.brand === brand)
  const stat = brandStats[0]

  return {
    ...lms,
    filialeBrands: [brand],
    brandStats,
    brandPifStats: (lms.brandPifStats ?? []).filter(row => row.brand === brand),
    collaboratorEvaluations: (lms.collaboratorEvaluations ?? []).filter(
      entry => evalMatchesBrand(entry, brand),
    ),
    technicians: (lms.technicians ?? []).filter(row => rowMatchesBrand(row, brand)),
    pifTechnicians: (lms.pifTechnicians ?? []).filter(row => rowMatchesBrand(row, brand)),
    kiScope: {
      ...(lms.kiScope ?? {}),
      instructorBrand: brand,
    },
    kiResults: stat ? {
      testsValidated: stat.evaluated ?? 0,
      avgScore: stat.avgScore ?? null,
      learnersAssessed: stat.technicians ?? 0,
    } : lms.kiResults,
  }
}

export function resolveKiDisplayUser(user, lms) {
  if (!user) return user
  const brand = resolveKiInstructorBrand(user, lms)
  return {
    ...user,
    brands: [brand],
    instructorBrands: user.instructorBrands?.length ? user.instructorBrands : [brand],
  }
}

/** Techniciens PIF filiale — uniquement la marque instructeur du KI. */
export function resolveKiFilialePifTechnicians(lms, instructorBrand) {
  const brand = instructorBrand ?? resolveKiInstructorBrand(null, lms)
  return resolveDpsFilialePifTechnicians(lms).filter(row => (
    row.brands?.includes(brand)
    || row.brand === brand
  ))
}

/** Base LMS vide pour le parcours personnel KI (données live via hooks MEDACAP). */
export const KI_PERSONAL_LMS_BASE = {
  modules: [],
  evaluations: [],
  certifications: [],
  assignedTrainings: [],
  planPathway: [],
  planningStatus: {},
  certGoals: [],
  alerts: [],
  discover: [],
  formationsADispenser: [],
  apprenants: [],
}
