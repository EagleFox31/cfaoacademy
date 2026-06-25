import CATALOG from '../data/training-catalog.json'
import { formatSessionDateRange, resolveLearnerPlanningSessions } from './learnerPlanning.js'
import { canonicalTrainingCode } from './trainingCode.js'

const BRAND_TO_CATALOG = {
  toyota: 'TOYOTA',
  mercedes: 'MERCEDES',
  suzuki: 'SUZUKI',
  byd: 'BYD',
  mitsubishi: 'MITSUBISHI',
  stellantis: 'STELLANTIS',
  citroen: 'STELLANTIS',
  fuso: 'FUSO',
  hino: 'HINO',
  jcb: 'JCB',
  lovol: 'LOVOL',
  'renault-trucks': 'RENAULT TRUCKS',
  'king-long': 'KING LONG',
}

/** Recherche une formation dans training-catalog.json (marque + code). */
export function findCatalogTraining(brand, code) {
  const catalogKey = BRAND_TO_CATALOG[(brand ?? '').toLowerCase()] ?? (brand ?? '').toUpperCase()
  const levels = CATALOG[catalogKey]
  if (!Array.isArray(levels)) return null

  const wanted = canonicalTrainingCode(code)
  for (const group of levels) {
    for (const training of group.trainings ?? []) {
      if (canonicalTrainingCode(training.code) === wanted) {
        return {
          ...training,
          catalogLevel: group.level ?? null,
        }
      }
    }
  }
  return null
}

/** Formations d'un niveau constructeur (ex. G3 Toyota). */
export function getCatalogTrainingsForLevel(brand, level) {
  const catalogKey = BRAND_TO_CATALOG[(brand ?? '').toLowerCase()] ?? (brand ?? '').toUpperCase()
  const levels = CATALOG[catalogKey]
  if (!Array.isArray(levels)) return []
  const group = levels.find(g => g.level === level)
  return (group?.trainings ?? []).map(t => ({
    ...t,
    catalogLevel: group.level,
  }))
}

/** Enrichit les affectations LMS avec les libellés catalogue. */
export function enrichAssignedTrainings(assignments = []) {
  return assignments.map(item => {
    const catalog = findCatalogTraining(item.brand, item.code)
    return {
      ...item,
      title: catalog?.name ?? item.title ?? item.code,
      catalogLevel: catalog?.catalogLevel ?? item.level ?? null,
      trainingType: catalog?.type ?? item.trainingType ?? null,
    }
  })
}

/** Statut planning annuel → statut carte plan pluri annuel. */
function annualStatusToPlanStatus(annualStatus) {
  if (annualStatus === 'fait') return 'done'
  if (annualStatus === 'en_cours') return 'progress'
  if (annualStatus === 'inscrit') return 'scheduled'
  if (annualStatus === 'a_programmer') return 'todo'
  return 'todo'
}

/** Une session du planning annuel → entrée présentiel du plan pluri annuel. */
function planningSessionToAssigned(session, lms, planYear) {
  const isUnscheduled = session.annualStatus === 'a_programmer'
  const status = annualStatusToPlanStatus(session.annualStatus)
  const yearFromDate = session.date?.slice(0, 4)

  return {
    ...session,
    id: `plan-${session.uid}`,
    brand: session.brand ?? (session.marque ?? '').toLowerCase(),
    level: session.niveau,
    status,
    year: isUnscheduled
      ? planYear
      : (yearFromDate ? Number(yearFromDate) : planYear),
    date: isUnscheduled ? null : session.date,
    fin: isUnscheduled ? null : session.fin,
    dateRange: isUnscheduled ? null : session.dateRange,
    modality: 'presentiel',
    assignedBy: lms?.planAssignedBy ?? 'Fatou Mbaye',
    annualStatus: session.annualStatus,
  }
}

/** Parcours planifié explicite (tous les modules d'un ou plusieurs niveaux). */
function resolvePathwayBrand(entry, user) {
  if (entry?.brand) return String(entry.brand).toLowerCase()
  for (const id of user?.brands ?? []) {
    if (findCatalogTraining(id, entry.code)) return id.toLowerCase()
  }
  return (user?.brands?.[0] ?? 'toyota').toLowerCase()
}

function resolvePathwayPresentiel(user, lms, year) {
  const pathway = lms?.planPathway
  if (!pathway?.length || !user) return null

  const sessions = resolveLearnerPlanningSessions(user, lms, year)
  const statusMap = lms?.planningStatus ?? {}

  return pathway.map((entry) => {
    const brand = resolvePathwayBrand(entry, user)
    const wanted = canonicalTrainingCode(entry.code)
    const session = sessions.find(s => canonicalTrainingCode(s.code) === wanted)
    const catalog = findCatalogTraining(brand, entry.code)
    let date = entry.date ?? session?.date ?? null
    let fin = entry.fin ?? session?.fin ?? date
    const statusKey = date ? `${date}|${entry.code}` : `|${entry.code}`
    let annualStatus = entry.annualStatus
      ?? statusMap[statusKey]
      ?? statusMap[`${date}|${entry.code}`]
      ?? statusMap[`|${entry.code}`]
      ?? session?.annualStatus
      ?? (date ? 'a_inscrire' : 'a_programmer')

    if (date && !date.startsWith(String(year))) {
      return null
    }
    if (annualStatus === 'a_programmer' && !date && year !== new Date().getFullYear()) {
      return null
    }
    if (annualStatus === 'a_programmer') {
      date = null
      fin = null
    }

    const catalogKey = BRAND_TO_CATALOG[brand] ?? brand.toUpperCase()
    const base = session && date
      ? { ...session, brand, annualStatus, dateRange: formatSessionDateRange(session.date, session.fin) }
      : {
        uid: `pathway-${wanted}`,
        code: entry.code,
        nom: catalog?.name ?? entry.code,
        marque: catalogKey,
        brand,
        date,
        fin,
        lieu: entry.lieu ?? session?.lieu ?? user?.orgLabel ?? user?.filiale,
        formateur: entry.formateur ?? session?.formateur,
        annualStatus,
        dateRange: date ? formatSessionDateRange(date, fin) : null,
        niveau: catalog?.catalogLevel ?? entry.level,
      }

    return planningSessionToAssigned(base, lms, year)
  }).filter(Boolean)
}

/**
 * Plan pluri annuel : présentiel = parcours planPathway ou sessions planning annuel,
 * autres modalités = affectations explicites dans le LMS (e-learning, distanciel…).
 */
export function resolveLearnerAssignedTrainings(user, lms, year = 2026) {
  const presentielFromPlanning = resolvePathwayPresentiel(user, lms, year)
    ?? (user
      ? resolveLearnerPlanningSessions(user, lms, year).map(s => planningSessionToAssigned(s, lms, year))
      : [])

  const otherModalities = (lms?.assignedTrainings ?? []).filter(
    item => item.modality && item.modality !== 'presentiel',
  )

  return enrichAssignedTrainings([...presentielFromPlanning, ...otherModalities])
}

/** Ordre des sous-sections — plan pluri annuel. */
export const PLAN_MODALITY_ORDER = [
  'presentiel',
  'elearning',
  'distanciel',
  'coaching',
  'mentoring',
]

/** Regroupe les affectations par modalité (clé absente → présentiel). */
export function groupAssignedTrainingsByModality(trainings = []) {
  const groups = Object.fromEntries(PLAN_MODALITY_ORDER.map(m => [m, []]))
  for (const item of trainings) {
    const key = PLAN_MODALITY_ORDER.includes(item.modality) ? item.modality : 'presentiel'
    groups[key].push(item)
  }
  return groups
}
