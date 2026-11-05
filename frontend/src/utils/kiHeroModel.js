import { resolveKiUpcomingSessions } from '../components/KiNextActions.jsx'
import { resolveKiInstructorBrand } from './kiScope.js'
import { TEAM_BRAND_DEFS } from './teamBrands.js'

/** Toyota → KI ; Suzuki (et autres non-Toyota Motors) → PIC. */
export function resolveInstructorKind(user, lms) {
  const brand = resolveKiInstructorBrand(user, lms)
  if (brand === 'suzuki') return 'pic'
  if (user?.roles?.includes('pic') && !user?.roles?.includes('ki')) return 'pic'
  return 'ki'
}

/** Données hero instructeur filiale (KI ou PIC) — salutation, carte, KPIs. */
export function buildKiHeroModel(user, lms) {
  const brand = resolveKiInstructorBrand(user, lms)
  const instructorKind = resolveInstructorKind(user, lms)
  const brandDef = brand ? TEAM_BRAND_DEFS[brand] : null
  const brandLabel = brandDef?.label
    ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '—')
  const level = user?.certLevels?.[brand]
    ?? lms?.certGoals?.find(g => g.brand === brand)?.currentLevel
    ?? null

  return {
    brand,
    brandLabel,
    brandLogo: brandDef?.logo ?? null,
    level,
    instructorKind,
    technicianCount: lms?.kiResults?.learnersAssessed ?? lms?.apprenants?.length ?? 0,
    upcomingSessions: resolveKiUpcomingSessions(lms, 3),
    certGoal: lms?.certGoals?.[0] ?? null,
  }
}

export function instructorHeroGreetingKey(kind) {
  return kind === 'pic' ? 'pic_hero_greeting_filiale' : 'ki_hero_greeting_filiale'
}
