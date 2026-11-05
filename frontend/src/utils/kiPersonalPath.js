/**
 * Parcours personnel KI Toyota — formations restantes selon le niveau actuel.
 *
 * Niveau actuel G2 → modules catalogue G1 (strictement au-dessus, vers G1).
 * Session affichée seulement si planifiée dans le pays du KI (ex. Cameroun) ;
 * sinon card catalogue « Non planifiée ».
 */
import { SESSIONS } from '../data/index.js'
import { getCatalogTrainingsForLevel } from './assignedTrainings.js'
import { resolveKiInstructorBrand } from './kiScope.js'
import {
  formatSessionDateRange,
  planningSessionAccent,
} from './learnerPlanning.js'
import { TOYOTA_LEVEL_ORDER, competencyTierForCertLevel } from './learnerTests.js'
import { canonicalTrainingCode } from './trainingCode.js'

const FILIALE_LIEUX = {
  "Côte d'Ivoire": ['RCI', 'Abidjan'],
  Cameroun: ['Douala', 'Yaoundé', 'Yaounde', 'Cameroun'],
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
}

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function resolveLieux(user) {
  if (FILIALE_LIEUX[user?.pays]) return FILIALE_LIEUX[user.pays]
  if (FILIALE_LIEUX[user?.filiale]) return FILIALE_LIEUX[user.filiale]
  for (const [key, lieux] of Object.entries(FILIALE_LIEUX)) {
    if (user?.pays?.includes(key) || user?.filiale?.includes(key)) return lieux
  }
  return []
}

function matchesLieu(sessionLieu, allowedLieux) {
  if (!allowedLieux?.length) return false
  const lieu = (sessionLieu ?? '').trim()
  if (!lieu) return false
  return allowedLieux.some((token) => {
    const t = token.trim()
    return lieu === t || lieu.includes(t) || t.includes(lieu)
  })
}

function planningStatusKey(session) {
  return `${session.date}|${session.code}`
}

/** Niveaux encore à passer (au-dessus du niveau actuel, vers G1). */
export function remainingToyotaLevels(currentLevel) {
  const raw = String(currentLevel ?? 'G4').toUpperCase().trim()
  const idx = TOYOTA_LEVEL_ORDER.indexOf(raw)
  if (idx < 0) return [...TOYOTA_LEVEL_ORDER]
  return TOYOTA_LEVEL_ORDER.slice(idx + 1)
}

function resolveCurrentToyotaLevel(user, lms, brand) {
  const fromUser = user?.certLevels?.[brand]
  if (fromUser) return String(fromUser).toUpperCase().trim()
  const goal = (lms?.certGoals ?? []).find((g) => g.brand === brand)
  if (goal?.currentLevel) return String(goal.currentLevel).toUpperCase().trim()
  return 'G4'
}

/**
 * Certifications constructeur dérivées du niveau actuel.
 * KI G2 → G4 + G3 + G2 obtenus (échelle Toyota).
 * Ne remplace pas une liste LMS réelle si elle est déjà fournie.
 */
export function resolveToyotaAchievedCertifications(user, lms, { brand, t } = {}) {
  const b = brand ?? resolveKiInstructorBrand(user, lms)
  if (b !== 'toyota') return []

  const current = resolveCurrentToyotaLevel(user, lms, b)
  const idx = TOYOTA_LEVEL_ORDER.indexOf(current)
  if (idx < 0) return []

  const titleTpl = t?.ki_cert_title_tier ?? 'Toyota {level} — {tier}'
  const titlePlain = t?.ki_cert_title ?? 'Toyota {level}'
  const dateUnknown = t?.ki_cert_date_unknown ?? '—'

  return TOYOTA_LEVEL_ORDER.slice(0, idx + 1).map((level) => {
    const tier = competencyTierForCertLevel(level)
    const tierLabel = tier && t?.[`dps_level_${tier}`]
    const title = tierLabel
      ? titleTpl.replace('{level}', level).replace('{tier}', tierLabel)
      : titlePlain.replace('{level}', level)
    return {
      id: `toyota-cert-${level}`,
      title,
      brand: b,
      level,
      date: dateUnknown,
      certId: '—',
      validUntil: '—',
      derived: true,
    }
  })
}

/**
 * Prochaine session planifiée pour un code — uniquement dans le pays / filiale du KI.
 * Pas de repli sur un autre pays (ex. RCI pour un KI Cameroun).
 * Si aucune session locale → null → card « Non planifiée ».
 */
function findNextSessionForCode(code, user, marque) {
  const wanted = canonicalTrainingCode(code)
  const lieux = resolveLieux(user)
  const today = todayIso()

  if (!lieux.length) return null

  const candidates = SESSIONS
    .filter((s) => {
      if (s.marque !== marque) return false
      if (!s.date || s.date < today) return false
      if (!matchesLieu(s.lieu, lieux)) return false
      return canonicalTrainingCode(s.code) === wanted
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return candidates[0] ?? null
}

/**
 * @param {object} user
 * @param {object} lms
 * @param {{ statusOverrides?: Record<string, string> }} [opts]
 */
export function resolveKiPersonalToyotaPath(user, lms, opts = {}) {
  const brand = resolveKiInstructorBrand(user, lms)
  if (brand !== 'toyota') {
    return {
      brand,
      currentLevel: null,
      remainingLevels: [],
      items: [],
      done: 0,
      total: 0,
      pct: 0,
    }
  }

  const currentLevel = resolveCurrentToyotaLevel(user, lms, brand)
  const levels = remainingToyotaLevels(currentLevel)
  const marque = BRAND_MARQUE.toyota
  const statusMap = {
    ...(lms?.planningStatus ?? {}),
    ...(opts.statusOverrides ?? {}),
  }

  const items = []
  for (const level of levels) {
    for (const training of getCatalogTrainingsForLevel(brand, level)) {
      const session = findNextSessionForCode(training.code, user, marque)
      let annualStatus = null
      if (session) {
        const key = planningStatusKey(session)
        annualStatus = statusMap[key]
          ?? statusMap[session.uid]
          ?? statusMap[canonicalTrainingCode(training.code)]
          ?? 'a_inscrire'
      }

      items.push({
        id: `ki-path-${training.code}`,
        code: training.code,
        title: training.name,
        level,
        brand,
        session: session
          ? {
              ...session,
              id: session.uid,
              title: session.nom ?? training.name,
              brand,
              dateRange: formatSessionDateRange(session.date, session.fin),
              annualStatus,
            }
          : null,
        date: session?.date ?? null,
        dateRange: session
          ? formatSessionDateRange(session.date, session.fin)
          : null,
        annualStatus,
        enrolled: annualStatus === 'inscrit' || annualStatus === 'fait' || annualStatus === 'en_cours',
        accentColor: planningSessionAccent(annualStatus ?? 'a_programmer'),
      })
    }
  }

  const done = items.filter((i) => i.enrolled).length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : (levels.length === 0 ? 100 : 0)

  return {
    brand,
    currentLevel,
    remainingLevels: levels,
    items,
    done,
    total,
    pct,
    complete: levels.length === 0,
  }
}
