import { getCatalogTrainingsForLevel } from './assignedTrainings.js'
import { formationTestsCompleteForCode } from './learnerTests.js'
import { canonicalTrainingCode } from './trainingCode.js'

/**
 * Prérequis objectif certification = formations du niveau cible dans training-catalog.json,
 * validées si session planning « fait » ou test formation « done ».
 */
export function resolveCertGoalPrerequisites(user, lms, goal) {
  if (!goal?.targetLevel || !goal?.brand) {
    return { items: [], done: 0, total: 0 }
  }

  const trainings = getCatalogTrainingsForLevel(goal.brand, goal.targetLevel)
  if (!trainings.length) {
    return {
      items: [],
      done: goal.prerequisitesDone ?? 0,
      total: goal.prerequisitesTotal ?? 0,
      fallback: true,
    }
  }

  const evaluations = lms?.evaluations ?? []

  const items = trainings.map((training) => {
    const code = canonicalTrainingCode(training.code)
    const done = formationTestsCompleteForCode(evaluations, code)

    return {
      code: training.code,
      title: training.name,
      done,
    }
  })

  return {
    items,
    done: items.filter(i => i.done).length,
    total: items.length,
    fallback: false,
  }
}
