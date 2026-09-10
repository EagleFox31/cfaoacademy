import { SESSIONS } from '../data/index.js'
import CATALOG from '../data/training-catalog.json'
import { canonicalTrainingCode } from './trainingCode.js'
import { resolveTargetCertificationLevel, levelMatchesTarget } from './portalCertLevel.js'

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Filiale apprenant → lieux planning (sessions-2026.json). */
const FILIALE_LIEUX = {
  "Côte d'Ivoire": ['RCI', 'Abidjan'],
  Cameroun: ['Douala', 'Yaoundé', 'Cameroun'],
  Maroc: ['Maroc', 'Casablanca'],
  Sénégal: ['Dakar', 'Sénégal'],
  Ghana: ['Ghana', 'Accra'],
  Nigeria: ['Nigeria', 'Lagos'],
  Kenya: ['Kenya', 'Nairobi'],
  Tanzanie: ['Tanzanie'],
  Angola: ['Angola'],
  Madagascar: ['Madagascar'],
  Mozambique: ['Mozambique'],
  Zambie: ['Zambie'],
}

const BRAND_MARQUE = {
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
  sinotruk: 'SINOTRUK',
  shacman: 'SHACMAN',
}

/** Niveau catalogue (group.level) d'une session — sans passer par assignedTrainings (cycle d'import). */
function sessionCatalogLevel(session) {
  const key = BRAND_MARQUE[(session.brand ?? session.marque ?? '').toLowerCase()]
    ?? (session.marque ?? '').toUpperCase()
  const groups = CATALOG[key]
  if (!Array.isArray(groups)) return session.niveau || null
  const wanted = canonicalTrainingCode(session.code)
  for (const group of groups) {
    for (const training of group.trainings ?? []) {
      if (canonicalTrainingCode(training.code) === wanted) return group.level ?? null
    }
  }
  return session.niveau || null
}

function parseLocalDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

export function formatSessionDateRange(debut, fin) {
  if (!debut) return ''
  const d1 = parseLocalDate(debut)
  const d2 = parseLocalDate(fin ?? debut)
  const m1 = MOIS_FR[d1.getMonth()]
  const m2 = MOIS_FR[d2.getMonth()]
  const y = d1.getFullYear()

  if (!fin || debut === fin) {
    return `${d1.getDate()} ${m1} ${y}`
  }
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${d1.getDate()}–${d2.getDate()} ${m1} ${y}`
  }
  return `${d1.getDate()} ${m1} – ${d2.getDate()} ${m2} ${y}`
}

function matchesLieu(sessionLieu, allowedLieux) {
  if (!allowedLieux?.length) return true
  const lieu = (sessionLieu ?? '').trim()
  return allowedLieux.some((token) => {
    const t = token.trim()
    return lieu === t || lieu.includes(t) || t.includes(lieu)
  })
}

function planningStatusKey(session) {
  return `${session.date}|${session.code}`
}

/** Pays apprenant → lieux planning (fallback quand user.filiale n'est pas une clé connue). */
const PAYS_LIEUX = {
  Cameroun: ['Douala', 'Yaoundé', 'Cameroun'],
  "Côte d'Ivoire": ['RCI', 'Abidjan'],
  Maroc: ['Maroc', 'Casablanca'],
  Sénégal: ['Dakar', 'Sénégal'],
  Ghana: ['Ghana', 'Accra'],
  Nigeria: ['Nigeria', 'Lagos'],
  Kenya: ['Kenya', 'Nairobi'],
  'Burkina Faso': ['Burkina Faso'],
  Bénin: ['Bénin', 'Benin'],
  Togo: ['Togo'],
  Madagascar: ['Madagascar'],
}

/**
 * Lieux autorisés. Comportement historique : uniquement FILIALE_LIEUX[user.filiale]
 * (→ [] si filiale inconnue, donc aucun filtre lieu). La variante PL-MEDACAP
 * ajoute un repli par pays (user.pays) car sa filiale n'est pas une clé connue.
 */
function resolveAllowedLieux(user, lms) {
  const byFiliale = FILIALE_LIEUX[user?.filiale]
  if (byFiliale) return byFiliale
  if (lms?.portalVariant === 'pl-medacap') {
    return PAYS_LIEUX[user?.pays] ?? FILIALE_LIEUX[user?.pays] ?? []
  }
  return []
}

/** Niveau constructeur actuel du technicien pour une marque (certLevels prioritaire). */
function resolveUserBrandLevel(user, brandId) {
  return user?.certLevels?.[brandId]
    ?? user?.certLevels?.[(brandId ?? '').toLowerCase()]
    ?? user?.level
    ?? null
}

/**
 * Sessions planning annuel depuis sessions-2026.json (SESSIONS),
 * filtrées par filiale/pays + marques du profil.
 * Avec `targetLevelOnly` (défaut) : ne garde que les sessions du niveau
 * immédiatement supérieur (N+1) pour la marque concernée — Règle métier 1.
 * Statuts inscription : lms.planningStatus[`date|code`].
 */
export function resolveLearnerPlanningSessions(user, lms, year = 2026, { targetLevelOnly = false } = {}) {
  const lieux = resolveAllowedLieux(user, lms)
  const userBrands = user?.brands ?? []
  const brandById = new Map(
    userBrands.map(b => [BRAND_MARQUE[(b ?? '').toLowerCase()] ?? (b ?? '').toUpperCase(), b]),
  )
  const marques = [...brandById.keys()].filter(Boolean)

  const statusMap = lms?.planningStatus ?? {}

  return SESSIONS
    .filter((s) => {
      if (!s.date?.startsWith(String(year))) return false
      if (marques.length && !marques.includes(s.marque)) return false
      if (!matchesLieu(s.lieu, lieux)) return false

      if (targetLevelOnly) {
        const brandId = brandById.get(s.marque)
        if (brandId) {
          const target = resolveTargetCertificationLevel(resolveUserBrandLevel(user, brandId), brandId)
          const candidate = sessionCatalogLevel({ ...s, brand: brandId })
          if (candidate && !levelMatchesTarget(candidate, target)) return false
        }
      }

      return true
    })
    .map((s) => {
      const key = planningStatusKey(s)
      return {
        ...s,
        id: s.uid,
        title: s.nom,
        brand: (s.marque ?? '').toLowerCase(),
        dateRange: formatSessionDateRange(s.date, s.fin),
        annualStatus: statusMap[key] ?? statusMap[s.uid] ?? 'a_inscrire',
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Année d'une entrée du plan (champ `year` ou date de session). */
export function resolvePlanItemYear(item) {
  if (item?.year != null) return Number(item.year)
  const fromDate = item?.date?.slice(0, 4)
  return fromDate ? Number(fromDate) : null
}

export function matchesPlanStatusFilter(item, statusFilter) {
  if (statusFilter === 'all') return true
  return item.status === statusFilter
}

export function matchesPlanYearFilter(item, yearFilter) {
  if (yearFilter === 'all') return true
  return resolvePlanItemYear(item) === Number(yearFilter)
}

export function matchesPlanFilters(item, statusFilter, yearFilter) {
  return matchesPlanStatusFilter(item, statusFilter)
    && matchesPlanYearFilter(item, yearFilter)
}

/** Date visible sur la carte plan : année cible et session pas encore passée. */
export function shouldShowPlanSessionDate(session, year = new Date().getFullYear()) {
  const iso = session?.date
  if (!iso || iso === '—') return false
  if (!iso.startsWith(String(year))) return false
  const sessionDate = parseLocalDate(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return sessionDate >= today
}

/** Bordure gauche SessionCard portail — alignée sur le statut annuel. */
export const ANNUAL_STATUS_ACCENT = {
  fait: '#1aab5b',
  en_cours: '#e67e00',
  partiel: '#e67e00',
  inscrit: '#1a56db',
  a_inscrire: 'var(--muted)',
  a_programmer: 'var(--muted)',
  non_fait: 'var(--red)',
}

export function planningSessionAccent(annualStatus) {
  return ANNUAL_STATUS_ACCENT[annualStatus] ?? 'var(--muted)'
}

/** past | current | future | pluri */
export function resolvePlanScopePhase(scope, pluriToken = 'pluri') {
  if (scope === pluriToken) return 'pluri'
  const year = Number(scope)
  const current = new Date().getFullYear()
  if (year < current) return 'past'
  if (year > current) return 'future'
  return 'current'
}

export function bucketAnnualStatus(annualStatus) {
  if (annualStatus === 'fait') return 'done'
  if (annualStatus === 'en_cours') return 'inProgress'
  if (annualStatus === 'inscrit') return 'enrolled'
  if (annualStatus === 'a_programmer') return 'toSchedule'
  return 'toEnroll'
}

export function summarizeAnnualStatuses(statuses = []) {
  const summary = {
    total: statuses.length,
    done: 0,
    inProgress: 0,
    enrolled: 0,
    toEnroll: 0,
    toSchedule: 0,
  }

  for (const status of statuses) {
    const bucket = bucketAnnualStatus(status)
    if (bucket === 'done') summary.done += 1
    else if (bucket === 'inProgress') summary.inProgress += 1
    else if (bucket === 'enrolled') summary.enrolled += 1
    else if (bucket === 'toSchedule') summary.toSchedule += 1
    else summary.toEnroll += 1
  }

  return summary
}
