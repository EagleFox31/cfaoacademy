import { resolveFormationFicheUrl } from './formationFiche.js'
import { encodePublicFichePath } from './publicFiches.js'
import { resolveCardBrandBadge } from './cardBrandBadge.js'

/** Visuel technicien par marque (catalogues/) — aligné sur publicFiches.js */
const BRAND_TECH_PATH = {
  toyota: 'toyota/technicien_toyota.png',
  mercedes: 'mercedes/technicien_mercedes.png',
  stellantis: 'stellantis/technicien_stellantis.png',
  suzuki: 'suzuki/technicien_suzuki.png',
  byd: 'byd/technicien_byd.png',
  mitsubishi: 'mitsubishi/technicien_mitsubishi.png',
  'omoda-jaecco': 'omoda-jaecco/technicien_omoda.png',
  fuso: 'fuso/technicien_fuso.png',
  hino: 'hino/techniciens_hino.png',
  'renault trucks': 'renault trucks/techniciens_rt.png',
  sinotruk: 'sinotruk/technicien_sinotruk.png',
  shacman: 'shacman/technicien_shacman.png',
  'king long': 'king long/technicien_kinglong.png',
  bt: 'bt/technicien_bt.png',
  'toyota forklift': 'toyota forklift/technicien_forklift.png',
  jcb: 'jcb/technicien_jcb.png',
  lovol: 'lovol/technicien_lovol.png',
  carrosserie: 'carrosserie/carrossier.png',
}

/** Visuel cartes certifications — `public/assets/img_cards/certification.jpg` */
const CERT_CARD_IMG = '/assets/img_cards/certification.jpg'

/** Fallbacks par modalité (hors fiche PNG) */
const MODALITY_IMG = {
  presentiel: encodePublicFichePath('toyota/technicien_toyota.png'),
  distanciel: '/assets/dernière_section_accueil/reseau.jpg',
  elearning: '/assets/dernière_section_accueil/andragogie.jpg',
  mentoring: '/assets/dernière_section_accueil/experts.jpg',
  eval: encodePublicFichePath('toyota/technicien_toyota.png'),
  cert: CERT_CARD_IMG,
  session: encodePublicFichePath('toyota/technicien_toyota.png'),
}

function brandTechnicianImg(brand) {
  const key = (brand ?? '').toLowerCase().trim().replace(/-/g, ' ')
  const path = BRAND_TECH_PATH[key]
  return path ? encodePublicFichePath(path) : null
}

/**
 * Résout l'image d'une carte portail.
 * @param {{ code?: string, brand?: string, modality?: string, kind?: string }} opts
 * @returns {{ img: string, variant?: 'doc' }}
 */
export function resolvePortalCardImg({ code, brand, modality, kind }) {
  if (kind === 'cert') {
    return { img: CERT_CARD_IMG }
  }

  if (modality === 'elearning') {
    return { elearningIcon: true }
  }

  if (code) {
    const fiche = resolveFormationFicheUrl({ code, marque: brand })
    if (fiche) return { img: fiche, variant: 'doc' }
  }

  const brandImg = brandTechnicianImg(brand)
  if (brandImg) return { img: brandImg }

  if (modality && MODALITY_IMG[modality]) {
    return { img: MODALITY_IMG[modality] }
  }

  if (kind && MODALITY_IMG[kind]) {
    return { img: MODALITY_IMG[kind] }
  }

  return { img: MODALITY_IMG.presentiel }
}

/** Logo marque pour le corps de carte (comme SessionCard). */
export function resolvePortalCardBrand(brand) {
  if (!brand) return {}
  return resolveCardBrandBadge(brand)
}

/** Props img / variant / logo prêtes pour PvCard. */
export function portalPvCardMedia(item) {
  const resolved = resolvePortalCardImg({
    code: item.code ?? item.coverCode,
    brand: item.brand,
    modality: item.modality,
    kind: item.kind,
  })
  const { logo, label } = resolvePortalCardBrand(item.brand)

  if (resolved.elearningIcon) {
    return {
      elearningIcon: true,
      logo,
      brandLabel: !logo ? label : undefined,
    }
  }

  const { img, variant } = resolved
  const brandFallback = brandTechnicianImg(item.brand)
  return {
    img,
    imgFallback: brandFallback && brandFallback !== img ? brandFallback : MODALITY_IMG.presentiel,
    variant,
    logo,
    brandLabel: !logo ? label : undefined,
  }
}
