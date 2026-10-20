import { getPrimaryRole } from '../data/index.js'
import { isEquipmentEvalBrand, isEquipmentLearner } from './learnerTests.js'

/** Images de fond portail — chemins sous `/assets/` (public). */
export const PORTAL_BACKGROUND_IMAGES = {
  default: '/assets/hero/default.jpg',
  b2b: '/assets/hero/cta_hover_b2b.jpg',
  toyotaTechnician: '/assets/technicien_toyota.jpg',
  suzukiTechnician: '/assets/technicien_suzuki.jpg',
  multibrandTechnician: '/assets/technicien_multibrand.jpg',
  carrossier: '/assets/carrossier_peintre.jpg',
  dpsMotors: '/assets/directeur_operationnel.jpg',
  dpsEquipment: '/assets/directeur_op_engins.jpg',
  trainer: '/assets/formation_motorisation_centre_formation.jpg',
  yamahaTechnician: '/assets/hover_section_motors/08_hover_yamaha_bg.png',
  mercedesTechnician: '/assets/hover_section_motors/02_hover_mercedes_bg.png',
  equipmentTechnician: '/assets/hero/cta_hover_pl.jpg',
  motorsDefault: '/assets/hero/cta_hover_vl.jpg',
}

export const PORTAL_BACKGROUND_POSITIONS = {
  default: '58% top',
  b2b: '58% top',
  toyotaTechnician: '58% 18%',
  suzukiTechnician: '58% 18%',
  multibrandTechnician: '58% 14%',
  carrossier: '78% 6%',
  dpsMotors: '58% 12%',
  dpsEquipment: '58% 12%',
  trainer: '55% 22%',
  yamahaTechnician: '70% 8%',
  mercedesTechnician: '70% 8%',
  equipmentTechnician: '74% 5%',
  motorsDefault: '70% 8%',
}

const ADMIN_ROLES = new Set(['superadmin', 'branch_hr', 'branch_admin'])
const MANAGER_ROLES = new Set(['dps', 'dop'])
const TRAINER_ROLES = new Set(['trainer', 'ki', 'pic', 'center_director'])

/** Première marque Motors → clé visuelle (slug profil normalisé). */
const MOTORS_BRAND_BACKGROUND_KEYS = {
  toyota: 'toyotaTechnician',
  suzuki: 'suzukiTechnician',
  yamaha: 'yamahaTechnician',
  mercedes: 'mercedesTechnician',
  'mercedes-benz': 'mercedesTechnician',
}

function normalizeBrandSlug(brand) {
  return String(brand ?? '').trim().toLowerCase().replace(/\s+/g, '-')
}

function motorsBrandSlugs(user) {
  return (user?.brands ?? [])
    .map(normalizeBrandSlug)
    .filter(Boolean)
    .filter(slug => !isEquipmentEvalBrand(slug))
}

function isCarrossier(user) {
  return user?.persona === 'carrossier'
    || user?.departments?.includes('carrosserie')
    || user?.public === 'Carrossiers'
}

function isEquipmentContext(user) {
  if (isEquipmentLearner(user)) return true
  if (user?.departments?.includes('equipment')) return true
  const brands = user?.brands ?? []
  return brands.length > 0 && brands.every(brand => isEquipmentEvalBrand(brand))
}

function isMotorsContext(user) {
  if (isCarrossier(user) || isEquipmentContext(user)) return false
  if (user?.persona === 'vl' || user?.departments?.includes('motors')) return true
  return motorsBrandSlugs(user).length > 0
}

function pack(key) {
  return {
    key,
    src: PORTAL_BACKGROUND_IMAGES[key] ?? PORTAL_BACKGROUND_IMAGES.default,
    position: PORTAL_BACKGROUND_POSITIONS[key] ?? PORTAL_BACKGROUND_POSITIONS.default,
    isAdminView: key === 'b2b',
  }
}

/**
 * Sélection automatique du fond portail selon rôle, BU et première marque Motors.
 * @param {object | null | undefined} user
 */
export function resolvePortalBackgroundSelection(user) {
  if (!user) return pack('default')

  if (user.roles?.some(role => ADMIN_ROLES.has(role))) {
    return pack('b2b')
  }

  if (user.roles?.some(role => MANAGER_ROLES.has(role))) {
    return pack(isEquipmentContext(user) ? 'dpsEquipment' : 'dpsMotors')
  }

  const primaryRole = getPrimaryRole(user.roles ?? [])
  if (TRAINER_ROLES.has(primaryRole)) {
    return pack('trainer')
  }

  if (isCarrossier(user)) {
    return pack('carrossier')
  }

  if (isEquipmentContext(user)) {
    return pack('equipmentTechnician')
  }

  if (isMotorsContext(user)) {
    const motorsBrands = motorsBrandSlugs(user)
    if (motorsBrands.length > 1) {
      return pack('multibrandTechnician')
    }

    const firstBrand = motorsBrands[0] ?? normalizeBrandSlug(user?.brands?.[0])
    const brandKey = firstBrand && MOTORS_BRAND_BACKGROUND_KEYS[firstBrand]
    if (brandKey) {
      return pack(brandKey)
    }

    return pack('motorsDefault')
  }

  return pack('default')
}

/** @deprecated Alias — préférer resolvePortalBackgroundSelection */
export function resolvePortalBackgroundKey(user) {
  return resolvePortalBackgroundSelection(user).key
}

export function resolvePortalBackground(user) {
  return resolvePortalBackgroundSelection(user)
}
