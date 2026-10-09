import { resolveTeamBrands } from './teamBrands.js'

const EQUIPMENT_LEVEL_KEYS = {
  JUNIOR: 'cert_level_maintenance',
  SENIOR: 'cert_level_repair',
  EXPERT: 'cert_level_diagnostic',
}

/** Rang croissant du niveau (entrée → expert) pour trier les cartes marques. */
const CERT_LEVEL_RANK = {
  JUNIOR: 10,
  G4: 10,
  BRONZE: 10,
  BASIC: 10,
  SENIOR: 20,
  G3: 20,
  SILVER: 20,
  CERTIFIED: 20,
  EXPERT: 30,
  G2: 30,
  GOLD: 30,
  G1: 40,
}

function certLevelRank(level) {
  if (!level) return 999
  return CERT_LEVEL_RANK[level.toUpperCase().trim()] ?? 500
}

/** Libellé affiché pour un niveau certification (Motors G1–G4 ou Equipment Maint./Répar./Diag.). */
export function formatCertLevelLabel(level, t) {
  if (!level) return t?.cert_level_unknown ?? '—'
  const key = EQUIPMENT_LEVEL_KEYS[level]
  if (key && t?.[key]) return t[key]
  return level
}

/**
 * Paliers génériques : un niveau constructeur (quelle que soit la marque)
 * est rattaché à l'un des trois tiers ci-dessous. Le catalogue Poids Lourds /
 * Equipment n'expose que JUNIOR / SENIOR / EXPERT ; les autres alias couvrent
 * les nomenclatures Motors (G4→G1, Bronze→Gold, Basic→Certified…).
 */
const CERT_TIERS = [
  { tier: 'JUNIOR', aliases: ['JUNIOR', 'MAINTENANCE', 'G4', 'BASIC', 'BRONZE', 'STEP 1', 'N1'] },
  { tier: 'SENIOR', aliases: ['SENIOR', 'REPAIR', 'REPARATION', 'RÉPARATION', 'G3', 'SILVER', 'CERTIFIED', 'STEP 2', 'N2', 'N3'] },
  { tier: 'EXPERT', aliases: ['EXPERT', 'DIAGNOSTIC', 'G2', 'G1', 'GOLD', 'MASTER', 'STEP 3', 'N4', 'N5'] },
]

const TIER_ORDER = ['JUNIOR', 'SENIOR', 'EXPERT']

function normalizeLevel(level) {
  return String(level ?? '').toUpperCase().trim()
}

/** Tier générique (JUNIOR/SENIOR/EXPERT) d'un niveau constructeur, ou null. */
export function certLevelTier(level) {
  const norm = normalizeLevel(level)
  if (!norm || norm === '—') return null
  for (const { tier, aliases } of CERT_TIERS) {
    if (aliases.includes(norm)) return tier
  }
  return null
}

/**
 * Niveau cible immédiatement supérieur (N+1) pour une marque donnée.
 * - Non certifié / inconnu → JUNIOR (ou G4 pour Toyota)
 * - JUNIOR  → SENIOR (ou G3 pour Toyota)
 * - SENIOR  → EXPERT (ou G2 pour Toyota)
 * - EXPERT  → EXPERT (plafond)
 */
export function resolveTargetCertificationLevel(currentLevel, brand = '') {
  const b = String(brand ?? '').toLowerCase()
  const isToyota = b === 'toyota' || b === 'toyota-forklift' || b === 'toyota-material'
  const toyotaLadder = { '': 'G4', G4: 'G3', G3: 'G2', G2: 'G1', G1: 'G1' }

  const tier = certLevelTier(currentLevel)

  if (isToyota) {
    const norm = normalizeLevel(currentLevel)
    if (toyotaLadder[norm] != null) return toyotaLadder[norm]
    if (!tier) return 'G4'
    return { JUNIOR: 'G3', SENIOR: 'G2', EXPERT: 'G1' }[tier]
  }

  if (!tier) return 'JUNIOR'
  const idx = TIER_ORDER.indexOf(tier)
  return TIER_ORDER[Math.min(idx + 1, TIER_ORDER.length - 1)]
}

/**
 * Vrai si `candidateLevel` (niveau d'une session / formation catalogue)
 * correspond au tier attendu `targetLevel` (N+1). Comparaison par tier
 * générique : « SENIOR » == « Réparation » == « G3 ».
 */
export function levelMatchesTarget(candidateLevel, targetLevel) {
  if (!candidateLevel || !targetLevel) return false
  const c = normalizeLevel(candidateLevel)
  const target = normalizeLevel(targetLevel)
  if (c === target) return true
  const ct = certLevelTier(candidateLevel)
  const tt = certLevelTier(targetLevel)
  return Boolean(ct && tt && ct === tt)
}

/** Niveau actuel par marque du technicien (toutes les marques du profil). */
export function resolveLearnerBrandLevels(user, certGoals = []) {
  const brands = user?.brands ?? []
  if (!brands.length) return []

  const goalByBrand = Object.fromEntries(
    (certGoals ?? []).map(g => [g.brand, g]),
  )

  return resolveTeamBrands(brands)
    .map(({ id, label, logo }) => {
      const goal = goalByBrand[id]
      const currentLevel =
        user?.certLevels?.[id]
        ?? goal?.currentLevel
        ?? null

      return {
        brand: id,
        label,
        logo,
        currentLevel,
      }
    })
    .sort((a, b) => {
      const byLevel = certLevelRank(a.currentLevel) - certLevelRank(b.currentLevel)
      if (byLevel !== 0) return byLevel
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    })
}
