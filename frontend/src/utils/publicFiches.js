import { PUBLICS } from '../data/index.js'
import { HERO_IMAGES, HERO_BG_POSITION } from '../data/heroImages.js'

/** Cartes publics — visuels hero (pas les PNG fiches catalogue). */
const PUBLIC_HERO_ID = {
  'Techniciens Véhicules Légers': 'vl',
  'Techniciens Voitures': 'vl',
  'Techniciens Poids lourds, Engins, Chariots & Bus': 'pl',
  Carrossiers: 'carrossier',
  'Conseillers Services': 'savParts',
  'Manager et conseillers services administratifs, financiers': 'savParts',
  'Process Parts': 'savParts',
  Managers: 'savParts',
  'Manager et responsables organisation SAV': 'savParts',
  'Process SAV': 'savParts',
  Clients: 'b2b',
}

/** Fiches profil public (PNG dans `catalogues/`) + cartes sans action pour l’instant. */

const PUBLIC_LOCKED = new Set([
  'Technico-commerciaux',
  'Commerciaux',
  'Clients',
])

/** Slug URL → nom public */
export const PUBLIC_FICHE_SLUGS = {
  'techniciens-vehicules-legers': 'Techniciens Véhicules Légers',
  'techniciens-voitures': 'Techniciens Véhicules Légers',
  'techniciens-equipment': 'Techniciens Poids lourds, Engins, Chariots & Bus',
  carrossiers: 'Carrossiers',
  parts: 'Conseillers Services',
  'process-sav-parts': 'Managers',
}

/** Slug variante → logo marque (fiche technicien). */
export const PUBLIC_BRAND_LOGOS = {
  toyota: '/assets/logos/toyota.png',
  mercedes: '/assets/logos/mercedes.png',
  stellantis: '/assets/logos/stellantis.png',
  suzuki: '/assets/logos/suzuki.png',
  byd: '/assets/logos/byd.png',
  mitsubishi: '/assets/logos/mitsubishi.png',
  'omoda-jaecoo': '/assets/logos/omoda.png',
  fuso: '/assets/logos/fuso.png',
  hino: '/assets/logos/hino.png',
  'renault-trucks': '/assets/logos/renault-trucks.png',
  sinotruk: '/assets/logos/sinotruk.png',
  shacman: '/assets/logos/shacman.png',
  'king-long': '/assets/logos/kinglong.png',
  bt: '/assets/logos/bt.png',
  'toyota-forklift': '/assets/logos/toyota-forklift.png',
  jcb: '/assets/logos/jcb.png',
  lovol: '/assets/logos/lovol.png',
}

const TECHNICIENS_VL_SETS = [
  { slug: 'toyota', label: 'Toyota', path: 'toyota/technicien_toyota.png' },
  { slug: 'mercedes', label: 'Mercedes-Benz', path: 'mercedes/technicien_mercedes.png' },
  { slug: 'stellantis', label: 'Stellantis', path: 'stellantis/technicien_stellantis.png' },
  { slug: 'suzuki', label: 'Suzuki', path: 'suzuki/technicien_suzuki.png' },
  { slug: 'byd', label: 'BYD', path: 'byd/technicien_byd.png' },
  { slug: 'mitsubishi', label: 'Mitsubishi', path: 'mitsubishi/technicien_mitsubishi.png' },
  { slug: 'omoda-jaecoo', label: 'Omoda & Jaecoo', path: 'omoda-jaecco/technicien_omoda.png' },
]

const PUBLIC_FICHE_SETS = {
  'Techniciens Véhicules Légers': TECHNICIENS_VL_SETS,
  'Techniciens Voitures': TECHNICIENS_VL_SETS,
  'Techniciens Poids lourds, Engins, Chariots & Bus': [
    { slug: 'fuso', label: 'Fuso', path: 'fuso/technicien_fuso.png' },
    { slug: 'hino', label: 'Hino', path: 'hino/techniciens_hino.png' },
    { slug: 'renault-trucks', label: 'Renault Trucks', path: 'renault trucks/techniciens_rt.png' },
    { slug: 'sinotruk', label: 'Sinotruk', path: 'sinotruk/technicien_sinotruk.png' },
    { slug: 'shacman', label: 'Shacman', path: 'shacman/technicien_shacman.png' },
    { slug: 'king-long', label: 'King Long', path: 'king long/technicien_kinglong.png' },
    { slug: 'bt', label: 'BT', path: 'bt/technicien_bt.png' },
    { slug: 'toyota-forklift', label: 'Toyota Material', path: 'toyota forklift/technicien_forklift.png' },
    { slug: 'jcb', label: 'JCB', path: 'jcb/technicien_jcb.png' },
    { slug: 'lovol', label: 'Lovol', path: 'lovol/technicien_lovol.png' },
  ],
  Carrossiers: [{ slug: 'carrosserie', label: 'Carrosserie', path: 'carrosserie/carrossier.png' }],
  'Conseillers Services': [
    {
      slug: 'motors',
      label: 'Motors',
      path: 'process_sav_parts_motors/process_parts/profil_process_parts.png',
    },
    {
      slug: 'equipment',
      label: 'Equipment',
      path: 'process_sav_parts_equipment/process_parts/profil_parts_equipment.png',
    },
  ],
  'Manager et conseillers services administratifs, financiers': [
    {
      slug: 'motors',
      label: 'Motors',
      path: 'process_sav_parts_motors/process_parts/profil_process_parts.png',
    },
    {
      slug: 'equipment',
      label: 'Equipment',
      path: 'process_sav_parts_equipment/process_parts/profil_parts_equipment.png',
    },
  ],
  'Process Parts': [
    {
      slug: 'motors',
      label: 'Motors',
      path: 'process_sav_parts_motors/process_parts/profil_process_parts.png',
    },
    {
      slug: 'equipment',
      label: 'Equipment',
      path: 'process_sav_parts_equipment/process_parts/profil_parts_equipment.png',
    },
  ],
  Managers: [
    {
      slug: 'sav-motors',
      label: 'Profils SAV · Motors',
      path: 'process_sav_parts_motors/process_sav/profils_sav.png',
    },
  ],
  'Manager et responsables organisation SAV': [
    {
      slug: 'sav-motors',
      label: 'Profils SAV · Motors',
      path: 'process_sav_parts_motors/process_sav/profils_sav.png',
    },
  ],
  'Process SAV': [
    {
      slug: 'sav-motors',
      label: 'Profils SAV · Motors',
      path: 'process_sav_parts_motors/process_sav/profils_sav.png',
    },
  ],
}

function encodeCataloguePath(relPath) {
  return `/catalogues/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

export function isPublicCardLocked(publicName) {
  return PUBLIC_LOCKED.has(publicName)
}

export function getPublicFicheItems(publicName) {
  return PUBLIC_FICHE_SETS[publicName] ?? []
}

export function getPublicFicheSlug(publicName) {
  const entry = Object.entries(PUBLIC_FICHE_SLUGS).find(([, name]) => name === publicName)
  return entry?.[0] ?? null
}

export function getPublicRecord(publicName) {
  return PUBLICS.find((p) => p.name === publicName) ?? null
}

/** Lien carte → page de détail public. */
export function getPublicCardLink(publicName) {
  if (isPublicCardLocked(publicName)) return null
  const slug = getPublicFicheSlug(publicName)
  if (!slug || !getPublicFicheItems(publicName).length) {
    return `/formations?public=${encodeURIComponent(publicName)}`
  }
  const items = getPublicFicheItems(publicName)
  if (items.length > 1) {
    return `/publics/${slug}/${items[0].slug}`
  }
  return `/publics/${slug}`
}

export function getPublicCardImage(publicName, fallbackImg) {
  const heroId = PUBLIC_HERO_ID[publicName]
  if (heroId && HERO_IMAGES[heroId]) return HERO_IMAGES[heroId]
  return fallbackImg
}

export function getPublicCardImagePosition(publicName) {
  const heroId = PUBLIC_HERO_ID[publicName]
  if (heroId && HERO_BG_POSITION[heroId]) return HERO_BG_POSITION[heroId]
  return undefined
}

export function getPublicBySlug(slug) {
  const name = PUBLIC_FICHE_SLUGS[slug]
  if (!name) return null
  return {
    name,
    slug,
    record: getPublicRecord(name),
    items: getPublicFicheItems(name),
  }
}

export function resolvePublicFicheItem(slug, brandSlug) {
  const data = getPublicBySlug(slug)
  if (!data) return { data: null, item: null }
  if (!brandSlug) {
    return { data, item: data.items.length === 1 ? data.items[0] : null }
  }
  const item = data.items.find((i) => i.slug === brandSlug) ?? null
  return { data, item }
}

export function encodePublicFichePath(relPath) {
  return encodeCataloguePath(relPath)
}

export function getPublicBrandLogo(itemSlug) {
  return PUBLIC_BRAND_LOGOS[itemSlug] ?? null
}
