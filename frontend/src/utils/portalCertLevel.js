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
