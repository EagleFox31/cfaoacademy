import {
  medacapApiUrl,
  resolveMedacapUserQuery,
  isMedacapEnabled,
  MEDACAP_BASE_URL,
} from './medacapConfig.js'
import {
  isMedacapLearner,
  mergeMedacapLearnerEvaluations,
  resolveMedacapLearnerUser,
} from './medacapLearner.js'

export { isMedacapLearner, medacapLearnerSections } from './medacapLearner.js'

/** Réécrit launchUrl si l’API est lue en local mais le QCM tourne sur le serveur entreprise. */
export function normalizeMedacapLaunchUrl(url) {
  if (!url || !MEDACAP_BASE_URL) return url
  try {
    const src = new URL(url)
    const target = new URL(MEDACAP_BASE_URL)
    if (src.host === target.host) return url
    return `${MEDACAP_BASE_URL}${src.pathname}${src.search}`
  } catch {
    return url
  }
}

function normalizeEvaluations(list) {
  return list.map(e => {
    if (!e?.medacap?.launchUrl) return e
    return {
      ...e,
      medacap: {
        ...e.medacap,
        launchUrl: normalizeMedacapLaunchUrl(e.medacap.launchUrl),
      },
    }
  })
}

/**
 * Charge les tests compétence depuis MEDACAP Mesure.
 * @returns {Promise<{ evaluations: object[], userId?: string } | null>}
 */
export async function fetchMedacapCompetencyEvaluations(user) {
  if (!isMedacapEnabled()) return null

  const query = resolveMedacapUserQuery(user)
  if (!query) return null

  const url = medacapApiUrl('evaluations.php', query)
  const res = await fetch(url, { credentials: 'omit' })

  if (!res.ok) {
    if (res.status === 404) return { evaluations: [], userId: null }
    throw new Error(`MEDACAP ${res.status}`)
  }

  const data = await res.json()
  return {
    evaluations: normalizeEvaluations(Array.isArray(data.evaluations) ? data.evaluations : []),
    userId: data.userId ?? null,
    profile: data.profile ?? null,
  }
}

/** PIF apprenant depuis Define (allocations formation / validations). */
export async function fetchMedacapLearnerPif(user) {
  if (!isMedacapEnabled()) return null

  const query = resolveMedacapUserQuery(user)
  if (!query) return null

  const url = medacapApiUrl('learner-pif.php', query)
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) return null

  const data = await res.json()
  return {
    planningStatus: data.planningStatus ?? {},
    planPathway: data.planPathway ?? [],
    brandPifStats: data.brandPifStats ?? [],
  }
}

/** Identité affichée : mock + surcharge MEDACAP si compte technicien lié. */
export function resolvePortalDisplayUser(user, medacapProfile) {
  return resolveMedacapLearnerUser(user, medacapProfile)
}

/** @deprecated Utiliser mergeMedacapLearnerEvaluations via le hook. */
export function mergeLearnerEvaluations(mockEvaluations = [], medacapCompetency = [], user = null, lms = null) {
  return mergeMedacapLearnerEvaluations(mockEvaluations, medacapCompetency, user, lms)
}

/** Ouvre le QCM MEDACAP (session PHP via portal-launch). */
export function launchMedacapEval(evalItem) {
  const url = evalItem?.medacap?.launchUrl
  if (!url) return false
  window.location.assign(url)
  return true
}

/** Clic carte : lancer le test ou afficher le détail. */
export function handleEvalOpen(evalItem, openDetail, { locked = false } = {}) {
  if (locked) return
  if (evalItem?.status === 'done' || evalItem?.score != null) {
    openDetail?.(evalItem)
    return
  }
  if (evalItem?.medacap?.launchUrl && launchMedacapEval(evalItem)) return
  openDetail?.(evalItem)
}
