import { BRANDS } from '../data/index.js'

export const LOGO_CFAO_MOBILITY = '/assets/logo-cfao-mobility.jpg'
export const LOGO_CFAO_EQUIPMENT = '/assets/logo_cfao_equipment.png'
/** Logo transverse « toutes marques Equipment » (`assets/logo_equipment.png`). */
export const LOGO_EQUIPMENT = '/assets/logo_equipment.png'

const EQUIPMENT_MARQUES = new Set(
  BRANDS.filter((b) => b.bu === 'equipment').map((b) => b.name.toUpperCase()),
)
EQUIPMENT_MARQUES.add('TOYOTA FORKLIFT')

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

function norm(s) {
  return (s ?? '').trim().toUpperCase()
}

function isEquipmentBu(bu) {
  return /equipment/i.test(bu ?? '')
}

export function isEquipmentMarque(marque) {
  const key = norm(marque)
  if (!key) return false
  if (EQUIPMENT_MARQUES.has(key)) return true
  const first = key.split(/\s+/)[0]
  return EQUIPMENT_MARQUES.has(first)
}

export function isToutesMarquesEquipment(marque, ctx = {}) {
  if (ctx.variantSlug === 'equipment' || ctx.brandSlug === 'equipment') return true

  const key = norm(marque)
  if (key.startsWith('TOUTES MARQUES')) {
    return isEquipmentBu(ctx.bu) || ctx.tagClass === 'equipment' || ctx.tagClass === 'parts-eq'
  }

  return false
}

function isEquipmentBrandContext(ctx = {}) {
  if (ctx.publicSlug === 'techniciens-equipment') return true
  if (ctx.brandSlug && EQUIPMENT_BRAND_SLUGS.has(ctx.brandSlug)) return true
  if (isEquipmentMarque(ctx.marque)) return true
  return false
}

/**
 * Logo CFAO (gauche) pour fiches détail : Mobility, CFAO Equipment ou Equipment transverse.
 */
export function resolveDetailCfaoLogo(ctx = {}) {
  if (isToutesMarquesEquipment(ctx.marque, ctx)) return LOGO_EQUIPMENT
  if (isEquipmentBrandContext(ctx)) return LOGO_CFAO_EQUIPMENT
  return LOGO_CFAO_MOBILITY
}

export function resolvePublicDetailCfaoLogo(publicSlug, brandSlug) {
  return resolveDetailCfaoLogo({
    publicSlug,
    brandSlug,
    variantSlug: brandSlug,
    marque: brandSlug === 'equipment' ? 'TOUTES MARQUES' : null,
  })
}

export function resolveSessionDetailCfaoLogo(session) {
  if (!session) return LOGO_CFAO_MOBILITY
  return resolveDetailCfaoLogo({
    marque: session.marque,
    bu: session.bu,
    tagClass: session.tagClass,
  })
}

export function resolveArticleDetailCfaoLogo(article) {
  if (!article) return LOGO_CFAO_MOBILITY
  if (article.brand && isEquipmentMarque(article.brand)) {
    return LOGO_CFAO_EQUIPMENT
  }
  if (article.bu === 'Equipment') return LOGO_EQUIPMENT
  return LOGO_CFAO_MOBILITY
}
