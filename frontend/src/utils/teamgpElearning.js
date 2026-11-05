/**
 * E-learning Toyota TEAM-GP — catalogue G4→G1 + progression Excel liée MEDACAP.
 * Sources versionnées : frontend/src/data/toyota/*.json (export daté, hors API live).
 */
import catalogJson from '../data/toyota/teamgp-elearning-by-level.json'
import linksJson from '../data/toyota/teamgp-medacap-links.json'
import progressJson from '../data/toyota/teamgp-progress-by-id.json'
import { TOYOTA_LEVEL_ORDER } from './learnerTests.js'

const BY_LEVEL = catalogJson?.byLevel ?? {}
const LINKS = Array.isArray(linksJson?.links) ? linksJson.links : []
const PROGRESS_BY_ID = progressJson?.byTeamGpId ?? {}

const LINKED_BY_MEDACAP = new Map()
for (const link of LINKS) {
  if (link?.status !== 'linked' || !link.medacapUserId) continue
  LINKED_BY_MEDACAP.set(String(link.medacapUserId), link)
}

const TOYOTA_LEVELS = new Set(['G4', 'G3', 'G2', 'G1'])

export const TEAMGP_PROGRESS_STATUS = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  NOT_STARTED: 'not_started',
  UNKNOWN: 'unknown',
}

export function normalizeToyotaTeamgpLevel(raw, fallback = 'G4') {
  const token = String(raw ?? '').trim().toUpperCase()
  if (TOYOTA_LEVELS.has(token)) return token
  const match = token.match(/\b(G[1-4])\b/)
  if (match && TOYOTA_LEVELS.has(match[1])) return match[1]
  return fallback
}

export function nextTeamgpLevel(level) {
  const current = normalizeToyotaTeamgpLevel(level)
  const idx = TOYOTA_LEVEL_ORDER.indexOf(current)
  if (idx < 0 || idx >= TOYOTA_LEVEL_ORDER.length - 1) return null
  return TOYOTA_LEVEL_ORDER[idx + 1]
}

/** Grade visé Excel → Gx si possible, sinon libellé brut (ex. RE). */
export function resolveTeamgpTargetLevel(gradeVise, currentLevel) {
  if (gradeVise != null && String(gradeVise).trim() !== '') {
    const asGx = normalizeToyotaTeamgpLevel(gradeVise, null)
    if (asGx && TOYOTA_LEVELS.has(asGx)) return asGx
    const raw = String(gradeVise).trim().toUpperCase()
    if (raw) return raw
  }
  return nextTeamgpLevel(currentLevel)
}

/** Classe pastille G4→G1 (ou grade cible non-Gx) pour cards / tableau TEAM-GP. */
export function teamgpLevelChipClass(level, { next = false } = {}) {
  const raw = String(level ?? '').trim().toUpperCase()
  const gx = normalizeToyotaTeamgpLevel(raw, null)
  const key = (gx && TOYOTA_LEVELS.has(gx) ? gx : 'other').toLowerCase()
  return [
    'portal-teamgp-level-chip',
    `portal-teamgp-level-chip--${key}`,
    next && 'portal-teamgp-level-chip--next',
  ].filter(Boolean).join(' ')
}

export function requiredElearningForLevel(level) {
  const key = normalizeToyotaTeamgpLevel(level)
  const row = BY_LEVEL[key]
  return row?.elearningRequired ?? row?.onlineAssignedTypical ?? null
}

export function resolveTeamgpLinkForMedacapUser(medacapUserId) {
  if (medacapUserId == null || medacapUserId === '') return null
  return LINKED_BY_MEDACAP.get(String(medacapUserId)) ?? null
}

function resolveProgressStatus(done, required, rate) {
  if (done == null || required == null || required <= 0) return TEAMGP_PROGRESS_STATUS.UNKNOWN
  if (rate != null && rate >= 1) return TEAMGP_PROGRESS_STATUS.COMPLETED
  if (done > 0) return TEAMGP_PROGRESS_STATUS.IN_PROGRESS
  return TEAMGP_PROGRESS_STATUS.NOT_STARTED
}

function resolveModuleFlag(done, assigned) {
  if (done == null || assigned == null || assigned <= 0) return null
  return done >= assigned
}

function resolveTrackProgress(done, assigned) {
  if (done == null || assigned == null || assigned <= 0) {
    return { done: null, required: null, rate: null, pct: null, complete: null }
  }
  const rate = Math.min(1, done / assigned)
  return {
    done,
    required: assigned,
    rate,
    pct: Math.round(rate * 1000) / 10, // 1 décimale comme Excel (98.6%)
    complete: done >= assigned,
  }
}

function finiteOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function attachOnlineTracks(base, progressRow, link) {
  const elDone = progressRow?.elearningDone ?? link?.elearningDone ?? null
  const elAss = progressRow?.elearningAssigned ?? link?.elearningAssigned ?? null
  const etDone = progressRow?.etestDone ?? link?.etestDone ?? null
  const etAss = progressRow?.etestAssigned ?? link?.etestAssigned ?? null
  const pratDone = progressRow?.practicalDone ?? link?.practicalDone ?? null
  const pratAss = progressRow?.practicalAssigned ?? link?.practicalAssigned ?? null
  const othDone = progressRow?.othersDone ?? link?.othersDone ?? null
  const othAss = progressRow?.othersAssigned ?? link?.othersAssigned ?? null

  const elearning = resolveTrackProgress(finiteOrNull(elDone), finiteOrNull(elAss))
  const etest = resolveTrackProgress(finiteOrNull(etDone), finiteOrNull(etAss))
  const practical = resolveTrackProgress(finiteOrNull(pratDone), finiteOrNull(pratAss))
  const others = resolveTrackProgress(finiteOrNull(othDone), finiteOrNull(othAss))

  const cat = BY_LEVEL[base.level]
  if (elearning.required == null && cat?.elearningModulesTypical != null) {
    elearning.required = cat.elearningModulesTypical
  }
  if (etest.required == null && cat?.etestModulesTypical != null) {
    etest.required = cat.etestModulesTypical
  }

  const elearningComplete = resolveModuleFlag(elearning.done, elearning.required)
  const etestComplete = resolveModuleFlag(etest.done, etest.required)
  const practicalComplete = resolveModuleFlag(practical.done, practical.required)
  const othersComplete = resolveModuleFlag(others.done, others.required)

  let onlineComplete = null
  if (elearningComplete != null && etestComplete != null) {
    onlineComplete = elearningComplete && etestComplete
  } else if (base.onlineRate != null) {
    onlineComplete = base.onlineRate >= 1
  }

  return {
    ...base,
    elearningDone: elearning.done,
    elearningRequired: elearning.required,
    elearningPct: elearning.pct,
    elearningComplete,
    etestDone: etest.done,
    etestRequired: etest.required,
    etestPct: etest.pct,
    etestComplete,
    practicalDone: practical.done,
    practicalRequired: practical.required,
    practicalPct: practical.pct,
    practicalComplete,
    othersDone: others.done,
    othersRequired: others.required,
    othersPct: others.pct,
    othersComplete,
    onlineComplete,
  }
}

/** Progression TEAM-GP pour un technicien PIF (id MEDACAP).
 *  - path* / progressStatus = parcours global Excel
 *    (= e-learning + e-test + pratiques + others)
 *  - online* = formation en ligne seule (e-learning + e-test)
 *  - elearning* / etest* / practical* / others* = split fiche / Synthèse
 *  - done/required/pct = alias path* (statut & taux UI = Excel)
 */
export function resolveTeamgpElearningForTechnician(medacapUserId, { fallbackLevel = 'G4' } = {}) {
  const link = resolveTeamgpLinkForMedacapUser(medacapUserId)
  if (link) {
    const level = normalizeToyotaTeamgpLevel(link.niveauAnalyse, fallbackLevel)
    const progressRow = link.teamGpId ? PROGRESS_BY_ID[link.teamGpId] : null
    const gradeVise = progressRow?.gradeVise ?? link.gradeVise ?? null
    const targetLevel = resolveTeamgpTargetLevel(gradeVise, level)

    const onlineDone = finiteOrNull(progressRow?.onlineDone ?? link.onlineDone)
    const onlineRequired = finiteOrNull(progressRow?.onlineAssigned ?? link.onlineAssigned)
      ?? requiredElearningForLevel(level)
    const onlineTrack = resolveTrackProgress(onlineDone, onlineRequired)

    const pathDone = finiteOrNull(progressRow?.modulesTermines ?? link.modulesTermines)
    const pathRequired = finiteOrNull(progressRow?.modulesAssignes ?? link.modulesAssignes)
    const pathTrack = resolveTrackProgress(pathDone, pathRequired)

    // Statut / % principaux = parcours global (comme Excel « Taux » / « Terminé »)
    const statusDone = pathTrack.done ?? onlineTrack.done
    const statusRequired = pathTrack.required ?? onlineTrack.required
    const statusRate = pathTrack.rate ?? onlineTrack.rate
    const statusPct = pathTrack.pct ?? onlineTrack.pct

    const base = {
      linked: true,
      level,
      targetLevel,
      nextLevel: nextTeamgpLevel(level),
      gradeVise: gradeVise != null ? String(gradeVise).trim() : null,
      levelSource: 'excel',
      done: statusDone,
      required: statusRequired,
      rate: statusRate,
      pct: statusPct,
      pathDone: pathTrack.done,
      pathRequired: pathTrack.required,
      pathRate: pathTrack.rate,
      pathPct: pathTrack.pct,
      onlineDone: onlineTrack.done,
      onlineRequired: onlineTrack.required,
      onlineRate: onlineTrack.rate,
      onlinePct: onlineTrack.pct,
      progressStatus: resolveProgressStatus(statusDone, statusRequired, statusRate),
      teamGpId: link.teamGpId ?? null,
      lastActivityAt: progressRow?.lastActivityAt ?? link.lastActivityAt ?? null,
      name: link.medacapName || link.excelName || null,
      agency: null,
    }
    return attachOnlineTracks(base, progressRow, link)
  }

  const level = normalizeToyotaTeamgpLevel(fallbackLevel)
  const required = requiredElearningForLevel(level)
  const base = {
    linked: false,
    level,
    targetLevel: nextTeamgpLevel(level),
    nextLevel: nextTeamgpLevel(level),
    gradeVise: null,
    levelSource: 'catalog_default',
    done: null,
    required,
    rate: null,
    pct: null,
    pathDone: null,
    pathRequired: null,
    pathRate: null,
    pathPct: null,
    onlineDone: null,
    onlineRequired: required,
    onlineRate: null,
    onlinePct: null,
    progressStatus: TEAMGP_PROGRESS_STATUS.UNKNOWN,
    teamGpId: null,
    lastActivityAt: null,
    name: null,
    agency: null,
  }
  return attachOnlineTracks(base, null, null)
}

/** Techniciens MEDACAP liés — pour page détail TEAM-GP filiale. */
export function resolveTeamgpLinkedTechnicians() {
  const linked = LINKS.filter(l => l?.status === 'linked' && l.medacapUserId)
  return linked
    .map(link => {
      const progress = resolveTeamgpElearningForTechnician(link.medacapUserId)
      return {
        ...progress,
        id: String(link.medacapUserId),
        name: link.medacapName || link.excelName || progress.name,
        excelName: link.excelName ?? null,
        teamGpId: link.teamGpId ?? progress.teamGpId,
      }
    })
    .sort((a, b) => {
      const levelDiff = TOYOTA_LEVEL_ORDER.indexOf(a.level) - TOYOTA_LEVEL_ORDER.indexOf(b.level)
      if (levelDiff !== 0) return levelDiff
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'fr', { sensitivity: 'base' })
    })
}

/** Agrégat filiale KI — techniciens MEDACAP liés à un export TEAM-GP. */
export function resolveTeamgpElearningFilialeSummary() {
  const technicians = resolveTeamgpLinkedTechnicians()
  let doneSum = 0
  let requiredSum = 0
  let rateSum = 0
  let rateCount = 0

  const byLevel = {
    G4: { count: 0, rateSum: 0, rateCount: 0, avgPct: null },
    G3: { count: 0, rateSum: 0, rateCount: 0, avgPct: null },
    G2: { count: 0, rateSum: 0, rateCount: 0, avgPct: null },
    G1: { count: 0, rateSum: 0, rateCount: 0, avgPct: null },
  }

  for (const progress of technicians) {
    const bucket = byLevel[progress.level]
    if (bucket) {
      bucket.count += 1
      if (progress.rate != null) {
        bucket.rateSum += progress.rate
        bucket.rateCount += 1
      }
    }
    if (progress.done != null) doneSum += progress.done
    if (progress.required != null) requiredSum += progress.required
    if (progress.rate != null) {
      rateSum += progress.rate
      rateCount += 1
    }
  }

  for (const level of Object.keys(byLevel)) {
    const bucket = byLevel[level]
    bucket.avgPct = bucket.rateCount
      ? Math.round((bucket.rateSum / bucket.rateCount) * 100)
      : null
  }

  const avgRate = rateCount ? rateSum / rateCount : null
  const avgPct = avgRate != null ? Math.round(avgRate * 100) : null

  return {
    linkedCount: technicians.length,
    doneSum,
    requiredSum,
    avgRate,
    avgPct,
    byLevel,
    levelOrder: ['G4', 'G3', 'G2', 'G1'],
    catalogByLevel: BY_LEVEL,
    technicians,
  }
}
