import { resolveUserPersonaId } from './portalPersona.js'

/** Chemins hero — alignés sur `HomeHero.jsx` et `public/assets/hero/` */
export const PORTAL_HERO_IMAGES = {
  default: '/assets/hero/default.jpg',
  vl: '/assets/hero/cta_hover_vl.jpg',
  pl: '/assets/hero/cta_hover_pl.jpg',
  carrossier: '/assets/hero/cta_hover_carrosserie.png',
  savParts: '/assets/hero/cta_hover_sav.jpg',
  b2b: '/assets/hero/cta_hover_b2b.jpg',
}

export const PORTAL_HERO_BG_POSITION = {
  default: '58% top',
  vl: '70% 8%',
  pl: '74% 5%',
  carrossier: '78% 6%',
  savParts: '68% 10%',
  b2b: '58% top',
}

const ADMIN_BG_KEYS = new Set(['b2b'])

const ADMIN_ROLES = new Set(['superadmin', 'branch_hr', 'branch_admin'])

/**
 * Clé visuelle hero pour le profil connecté (persona ou vue groupe).
 * @param {object | null | undefined} user
 * @returns {keyof typeof PORTAL_HERO_IMAGES}
 */
export function resolvePortalBackgroundKey(user) {
  if (!user) return 'default'

  if (user.roles?.some(r => ADMIN_ROLES.has(r))) {
    return 'b2b'
  }

  const personaId = resolveUserPersonaId(user)
  if (personaId && PORTAL_HERO_IMAGES[personaId]) {
    return personaId
  }

  return 'default'
}

/**
 * Image et cadrage du fond portail selon le profil.
 * @param {object | null | undefined} user
 * @returns {{ key: keyof typeof PORTAL_HERO_IMAGES, src: string, position: string, isAdminView: boolean }}
 */
export function resolvePortalBackground(user) {
  const key = resolvePortalBackgroundKey(user)
  return {
    key,
    src: PORTAL_HERO_IMAGES[key] ?? PORTAL_HERO_IMAGES.default,
    position: PORTAL_HERO_BG_POSITION[key] ?? PORTAL_HERO_BG_POSITION.default,
    isAdminView: ADMIN_BG_KEYS.has(key),
  }
}
