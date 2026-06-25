import { findCatalogTraining } from './assignedTrainings.js'
import { resolveLearnerPlanningSessions } from './learnerPlanning.js'
import { canonicalTrainingCode } from './trainingCode.js'

/** Toyota Motors : G4 (entrée) → G1 (sommet). */
export const TOYOTA_LEVEL_ORDER = ['G4', 'G3', 'G2', 'G1']

/** Palier mesure de compétences ↔ niveau certification (Motors G* ou Equipment Maint./Répar./Diag.). */
export const COMPETENCY_TIER_BY_LEVEL = {
  G4: 'junior',
  G3: 'senior',
  G2: 'expert',
  G1: 'expert',
  JUNIOR: 'junior',
  SENIOR: 'senior',
  EXPERT: 'expert',
}

export const COMPETENCY_TIERS = ['junior', 'senior', 'expert']

const TIER_LEVEL = {
  junior: 'G4',
  senior: 'G3',
  expert: 'G2',
}

export function competencyTierForCertLevel(level) {
  if (!level) return null
  const key = typeof level === 'string' ? level.toUpperCase().trim() : level
  return COMPETENCY_TIER_BY_LEVEL[key] ?? null
}

export function certLevelForCompetencyTier(tier) {
  return TIER_LEVEL[tier] ?? null
}

export function compareToyotaLevels(a, b) {
  return TOYOTA_LEVEL_ORDER.indexOf(a) - TOYOTA_LEVEL_ORDER.indexOf(b)
}

/** Statut planning de la session liée à une formation (date|code). */
export function formationPlanningStatus(user, lms, code, year = 2026) {
  const wanted = canonicalTrainingCode(code)
  const session = resolveLearnerPlanningSessions(user, lms, year)
    .find(s => canonicalTrainingCode(s.code) === wanted)
  if (session?.annualStatus) return session.annualStatus

  const statusMap = lms?.planningStatus ?? {}
  for (const [key, status] of Object.entries(statusMap)) {
    const keyCode = canonicalTrainingCode(key.split('|')[1] ?? '')
    if (keyCode === wanted) return status
  }
  return null
}

/** Test formation : débloqué après la session présentiel (fait ou en cours). */
export function isFormationTestUnlocked(user, lms, evalItem, year = 2026) {
  if (evalItem?.kind !== 'formation' || !evalItem.code) return true
  const status = formationPlanningStatus(user, lms, evalItem.code, year)
  return status === 'fait' || status === 'en_cours'
}

/** Test formation pas encore accessible (avant la session présentiel). */
export function isFormationTestLocked(user, lms, evalItem, year = 2026) {
  return !isFormationTestUnlocked(user, lms, evalItem, year)
}

export const EVAL_STATUS_FILTER_IDS = ['all', 'todo', 'done']

/** Toyota Motors — groupes tests formations par niveau G. */
export const TOYOTA_FORMATION_GROUP_IDS = [
  'formation_g4',
  'formation_g3',
  'formation_g2',
  'formation_g1',
]

/** Equipment & marques JUNIOR / SENIOR / EXPERT — pas de niveaux G Toyota. */
export const EQUIPMENT_FORMATION_GROUP_IDS = [
  'formation_junior',
  'formation_senior',
  'formation_expert',
]

/** @deprecated Utiliser resolveEvalGroupIds(user) */
export const EVAL_GROUP_IDS = ['competency', ...TOYOTA_FORMATION_GROUP_IDS]

/** Marques catalogue Equipment (slug profil / eval.brand). */
const EQUIPMENT_BRAND_SLUGS = new Set([
  'fuso',
  'hino',
  'renault-trucks',
  'sinotruk',
  'shacman',
  'king-long',
  'bt',
  'toyota-forklift',
  'jcb',
  'lovol',
])

export function isEquipmentEvalBrand(brand) {
  if (!brand) return false
  const slug = String(brand).toLowerCase().trim().replace(/\s+/g, '-')
  return EQUIPMENT_BRAND_SLUGS.has(slug)
}

function useEquipmentTestImages(evalItem, user) {
  if (isEquipmentEvalBrand(evalItem?.brand)) return true
  return Boolean(user && isEquipmentLearner(user))
}

export function isEquipmentLearner(user) {
  const depts = user?.departments ?? []
  if (depts.includes('equipment') && !depts.includes('motors')) return true
  if (user?.persona === 'pl') return true
  return false
}

/** Libellé palier compétences / formation — Equipment : Maintenance/Réparation/Diagnostic ; Motors : Junior/Senior/Expert. */
export function resolveCompetencyTierLabel(tier, t, user) {
  if (!tier) return null
  const key = isEquipmentLearner(user)
    ? `competency_scope_${tier}`
    : `competency_${tier}`
  return t?.[key] ?? tier
}

/** Sous-sections « Vos tests » selon la BU (Motors G* vs Equipment Maintenance/Réparation/Diagnostic). */
export function resolveEvalGroupIds(user) {
  const formationGroups = isEquipmentLearner(user)
    ? EQUIPMENT_FORMATION_GROUP_IDS
    : TOYOTA_FORMATION_GROUP_IDS
  return ['competency', ...formationGroups]
}

export function evalCatalogLevel(evalItem) {
  if (evalItem.kind === 'competency') return evalItem.certLevel ?? null
  if (evalItem.kind === 'formation' && evalItem.code) {
    return findCatalogTraining(evalItem.brand, evalItem.code)?.catalogLevel ?? null
  }
  return evalItem.certLevel ?? null
}

export function isEvalDone(evalItem) {
  return evalItem?.status === 'done'
}

export function evalGroupId(evalItem) {
  if (evalItem?.kind === 'competency') return 'competency'
  const level = evalCatalogLevel(evalItem)
  return level ? `formation_${level.toLowerCase()}` : null
}

export function matchesEvalStatusFilter(evalItem, filterId) {
  if (filterId === 'all') return true
  if (filterId === 'done') return isEvalDone(evalItem)
  if (filterId === 'todo') return !isEvalDone(evalItem)
  return true
}

export function matchesEvalGroup(evalItem, groupId) {
  return evalGroupId(evalItem) === groupId
}

/** Regroupe les évaluations par sous-section (compétence + formations par niveau). */
export function groupEvaluationsBySection(evaluations = [], groupIds = EVAL_GROUP_IDS) {
  const groups = Object.fromEntries(groupIds.map(id => [id, []]))
  for (const e of evaluations) {
    const id = evalGroupId(e)
    if (id && groups[id]) groups[id].push(e)
  }
  return groups
}

/** Résultats validés des tests de compétences (mesure par marque). */
export function competencyResultEvaluations(evaluations = []) {
  return evaluations.filter(e => e.kind === 'competency' && isEvalDone(e))
}

/** Tests restants : formations + compétences non terminées. */
export function learnerTestEvaluations(evaluations = []) {
  return evaluations.filter(e => !(e.kind === 'competency' && isEvalDone(e)))
}

/** Tests mesure de compétences (section « Vos tests »). */
export function competencyTestEvaluations(evaluations = []) {
  return evaluations.filter(e => e.kind === 'competency')
}

/** Tests formation (section « Vos tests », regroupement par marque). */
export function formationTestEvaluations(evaluations = []) {
  return evaluations.filter(e => e.kind === 'formation')
}

/** Regroupe les évaluations par marque (ordre profil en premier). */
export function groupEvaluationsByBrand(evaluations = [], brandOrder = []) {
  const order = [...brandOrder]
  const groups = Object.fromEntries(brandOrder.map(id => [id, []]))
  for (const e of evaluations) {
    const brand = e.brand
    if (!brand) continue
    if (!groups[brand]) {
      groups[brand] = []
      if (!order.includes(brand)) order.push(brand)
    }
    groups[brand].push(e)
  }
  return { groups, order }
}

/** Les deux tests formation (théorie + pratique) sont validés pour ce code. */
export function formationTestsCompleteForCode(evaluations, code) {
  const wanted = canonicalTrainingCode(code)
  const match = (modality) => (evaluations ?? []).some(
    e => e.kind === 'formation'
      && canonicalTrainingCode(e.code) === wanted
      && e.modality === modality
      && e.status === 'done',
  )
  return match('theory') && match('practical')
}

/** Niveau cible = un cran au-dessus du niveau actuel (vers G1). */
export function nextToyotaCertLevel(currentLevel) {
  const idx = TOYOTA_LEVEL_ORDER.indexOf(currentLevel)
  if (idx <= 0) return null
  return TOYOTA_LEVEL_ORDER[idx - 1]
}

/** Adjectif modalité pour les titres (« Test théorique — F01 », « Theoretical test — F01 »). */
function evalModalityInTitle(evalItem, t) {
  const adj = evalItem.modality === 'practical'
    ? t.test_modality_practical
    : t.test_modality_theory
  if (!adj) return adj

  const titleTpl = evalItem.kind === 'formation'
    ? t.test_title_formation
    : t.test_title_competency

  if (titleTpl?.startsWith('Test {modality}') || titleTpl?.includes('— {modality}')) {
    return adj.charAt(0).toLowerCase() + adj.slice(1)
  }

  return adj
}

export function resolveEvalTitle(evalItem, t, user) {
  if (evalItem.title) return evalItem.title

  const modality = evalModalityInTitle(evalItem, t)

  if (evalItem.kind === 'competency' && evalItem.competencyTier) {
    const tier = resolveCompetencyTierLabel(evalItem.competencyTier, t, user)
    return t.test_title_competency.replace('{tier}', tier).replace('{modality}', modality)
  }

  if (evalItem.kind === 'formation' && evalItem.code) {
    return t.test_title_formation
      .replace('{modality}', modality)
      .replace('{code}', evalItem.code)
      .replace('{name}', findCatalogTraining(evalItem.brand, evalItem.code)?.name ?? evalItem.code)
  }

  return modality
}

export function resolveEvalFormationMeta(evalItem, t) {
  if (evalItem?.kind !== 'formation' || !evalItem.code) return null
  const catalog = findCatalogTraining(evalItem.brand, evalItem.code)
  return t.test_formation_meta.replace('{name}', catalog?.name ?? evalItem.code)
}

export function evalStatusLabel(evalItem, t) {
  if (evalItem.status === 'upcoming') return t.status_upcoming
  if (evalItem.status === 'progress') return t.status_progress
  if (evalItem.status === 'done') return t.status_done
  return t.status_todo
}

export function evalStatusClass(evalItem) {
  return evalItem.status ?? 'todo'
}

export function evalScorePassed(evalItem) {
  if (evalItem.score == null) return null
  const threshold = evalItem.passMark ?? 60
  return evalItem.score >= threshold
}

/** Palier couleur note : 0–49 rouge, 50–79 orange, 80–100 vert. */
export function evalScoreTier(score) {
  if (score == null) return null
  const n = Number(score)
  if (Number.isNaN(n)) return null
  if (n <= 49) return 'low'
  if (n <= 79) return 'mid'
  return 'high'
}

export function evalScoreTierClass(tier) {
  return tier ? ` score-${tier}` : ''
}

export function evalQuestionsAnswered(evalItem) {
  return evalItem.questionsAnswered ?? 0
}

export function evalQuestionsRemaining(evalItem) {
  const total = evalItem.questions ?? 0
  return Math.max(0, total - evalQuestionsAnswered(evalItem))
}

export function evalAccentColor(evalItem) {
  if (evalItem.status === 'progress') return '#e67e00'
  const tier = evalScoreTier(evalItem.score)
  if (tier === 'high') return '#1aab5b'
  if (tier === 'mid') return '#e67e00'
  if (tier === 'low') return 'var(--red)'
  return 'var(--muted)'
}

function evalCardTier(evalItem) {
  if (evalItem.competencyTier) return evalItem.competencyTier
  if (evalItem.kind === 'formation' && evalItem.code) {
    const catalog = findCatalogTraining(evalItem.brand, evalItem.code)
    const fromCatalog = competencyTierForCertLevel(catalog?.catalogLevel)
    if (fromCatalog) return fromCatalog
  }
  const fromLevel = competencyTierForCertLevel(evalItem.certLevel)
  if (fromLevel) return fromLevel
  return null
}

/** Niveau formation test (1 Maintenance / 2 Réparation / 3 Diagnostic) depuis le palier. */
const FORMATION_TEST_NIVEAU_BY_TIER = {
  junior: 1,
  senior: 2,
  expert: 3,
}

function formationTestNiveau(evalItem) {
  const tier = evalCardTier(evalItem)
  return tier ? FORMATION_TEST_NIVEAU_BY_TIER[tier] ?? null : null
}

function equipmentPracticalTestMedia(niveau) {
  const base = `/assets/img_cards/equipment_niveau_${niveau}_test_pratique.png`
  return {
    img: base,
    imgFallback: `/assets/img_cards/formation_niveau_${niveau}_test_pratique.png`,
  }
}

function formationTestMedia(evalItem, niveau) {
  const mod = evalItem.modality === 'practical' ? 'pratique' : 'theorique'
  const base = `/assets/img_cards/formation_niveau_${niveau}_test`
  return {
    img: `${base}_${mod}.png`,
    imgFallback: `${base}_theorique.png`,
  }
}

/**
 * Visuels cartes test :
 * - Equipment pratique → `equipment_niveau_{1|2|3}_test_pratique.png`
 * - Equipment / Motors théorie & format. → `formation_niveau_{1|2|3}_test_{theorique|pratique}.png`
 * - Motors compét. pratique (hors Equipment) → `test_pratique_{junior|senior|expert}.jpg`
 * - Motors compét. théorie (hors Equipment) → `test_theorie_{junior|senior|expert}.jpg`
 */
export function resolveEvalCardMedia(evalItem, user = null) {
  if (!evalItem.modality) return null

  const niveau = formationTestNiveau(evalItem)
  const equipment = useEquipmentTestImages(evalItem, user)

  if (equipment && niveau && evalItem.modality === 'practical') {
    return equipmentPracticalTestMedia(niveau)
  }

  if (niveau && (evalItem.kind === 'formation' || equipment)) {
    return formationTestMedia(evalItem, niveau)
  }

  const tier = evalCardTier(evalItem)
  if (!tier) return null

  const mod = evalItem.modality === 'practical' ? 'pratique' : 'theorie'
  const theoryImg = `/assets/img_cards/test_theorie_${tier}.jpg`

  return {
    img: `/assets/img_cards/test_${mod}_${tier}.jpg`,
    imgFallback: theoryImg,
  }
}
