import { resolveTeamBrands } from './teamBrands.js'
import {
  competencyTestEvaluations,
  evalScoreTier,
  isEvalDone,
  resolveCompetencyTierLabel,
  resolveEvalTitle,
} from './learnerTests.js'

const TIER_ORDER = { junior: 0, senior: 1, expert: 2 }

function avg(nums) {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function sortTests(a, b) {
  const ta = TIER_ORDER[a.competencyTier] ?? 9
  const tb = TIER_ORDER[b.competencyTier] ?? 9
  if (ta !== tb) return ta - tb
  if (a.modality === b.modality) return 0
  return a.modality === 'theory' ? -1 : 1
}

/**
 * Calcule les scores par palier de compétence selon la règle MEDACAP CFAO :
 * min(théorie, pratique) — la note déclarative pratique étant déjà corrélée avec l'évaluation manager.
 */
export function calculateTierCompetencyScores(tests = []) {
  const tiers = ['junior', 'senior', 'expert']
  const tierScores = []

  for (const tier of tiers) {
    const tierTests = tests.filter(e => (e.competencyTier ?? '').toLowerCase() === tier && isEvalDone(e) && e.score != null)
    if (!tierTests.length) continue

    const theory = tierTests.find(e => e.modality === 'theory')
    const practical = tierTests.find(e => e.modality === 'practical')

    if (theory && practical) {
      tierScores.push(Math.min(theory.score, practical.score))
    } else {
      tierScores.push(tierTests[0].score)
    }
  }

  return tierScores
}

/**
 * Modèle bulletin — prêt pour extension GF (`specialities[]` depuis API `results`).
 * @param {object[]} evaluations
 * @param {object} user
 * @param {object} t — portal i18n
 */
export function buildCompetencyBulletinModel(evaluations = [], user, t) {
  const competency = competencyTestEvaluations(evaluations)
  const done = competency.filter(isEvalDone)
  const pending = competency.filter(e => !isEvalDone(e))

  const brandIds = [...new Set([
    ...(user?.brands ?? []),
    ...competency.map(e => e.brand).filter(Boolean),
  ])]

  const brandMeta = resolveTeamBrands(brandIds)
  const globalTierScores = calculateTierCompetencyScores(competency)

  const brands = brandMeta.map(({ id, label, logo }) => {
    const tests = competency
      .filter(e => e.brand === id || (e.brands ?? []).includes(id))
      .sort(sortTests)
      .map(e => ({
        ...e,
        title: resolveEvalTitle(e, t, user),
        tierLabel: resolveCompetencyTierLabel(e.competencyTier, t, user),
        scoreTier: e.score != null ? evalScoreTier(e.score) : null,
        passed: e.score != null && e.passMark != null ? e.score >= e.passMark : null,
        /** Réservé API : scores par GF (`results.speciality`) */
        specialities: e.specialities ?? [],
      }))

    const brandTierScores = calculateTierCompetencyScores(tests)

    return {
      id,
      label,
      logo,
      tests,
      doneCount: tests.filter(isEvalDone).length,
      avgScore: brandTierScores.length ? avg(brandTierScores) : null,
    }
  }).filter(b => b.tests.length > 0)

  return {
    summary: {
      testsDone: done.length,
      testsPassed: done.filter(e => e.score != null && e.passMark != null && e.score >= e.passMark).length,
      testsPending: pending.length,
      avgScore: globalTierScores.length ? avg(globalTierScores) : null,
      brandCount: brands.filter(b => b.doneCount > 0).length,
    },
    brands,
    pending,
    allTests: competency.sort(sortTests),
  }
}

export function findBulletinTest(model, evalId) {
  if (!evalId) return null
  for (const brand of model.brands) {
    const hit = brand.tests.find(t => t.id === evalId)
    if (hit) return { test: hit, brand }
  }
  return null
}

export function defaultBulletinSelection(model) {
  for (const brand of model.brands) {
    const done = brand.tests.find(isEvalDone)
    if (done) return { evalId: done.id, brandId: brand.id }
  }
  const first = model.brands[0]?.tests[0]
  return first ? { evalId: first.id, brandId: model.brands[0].id } : null
}
