import CATALOG from '../data/training-catalog.json'

/** Slug fiche public → clé catalogue technique. */
const SLUG_TO_CATALOG_KEY = {
  toyota: 'TOYOTA',
  mercedes: 'MERCEDES',
  stellantis: 'STELLANTIS',
  suzuki: 'SUZUKI',
  byd: 'BYD',
  mitsubishi: 'MITSUBISHI',
  'omoda-jaecoo': 'OMODA & JAECOO',
  fuso: 'FUSO',
  hino: 'HINO',
  'renault-trucks': 'RENAULT TRUCKS',
  sinotruk: 'SINOTRUK',
  shacman: 'SHACMAN',
  'king-long': 'KING LONG',
  bt: 'BT',
  'toyota-forklift': 'TOYOTA FORKLIFT',
  jcb: 'JCB',
  lovol: 'LOVOL',
  carrosserie: 'CARROSSERIE',
}

/** Parcours affichés sur la fiche profil (pyramide catalogue / constructeur). */
const PARCOURS_OVERRIDE_BY_SLUG = {
  mercedes: 'BASIC → CERTIFIED → EXPERT',
  mitsubishi: 'Step 1 → Step 2 → Step 3',
  stellantis: 'Induction 1 → Advanced 2 → Advanced 3',
  byd: 'Junior → Senior → Expert',
  'omoda-jaecoo': 'Junior → Certified',
  carrosserie: 'N1 → N2 → N3 → N4 → N5',
}

const SKIP_LEVEL = /^Autre$|^Pièces$|BASIC \(CFAO\)|Process/i

function formatLevelLabel(level) {
  return level
    .trim()
    .replace(/^Induction Level (\d+)$/i, 'Induction $1')
    .replace(/^Advanced Level (\d+)$/i, 'Advanced $1')
    .replace(/^BASIC \(MERCEDES\)$/i, 'BASIC')
    .replace(/^BRONZE$/i, 'Bronze')
    .replace(/^SILVER$/i, 'Silver')
    .replace(/^GOLD$/i, 'Gold')
    .replace(/^Junior$/i, 'Junior')
    .replace(/^JUNIOR$/i, 'Junior')
    .replace(/^SENIOR$/i, 'Senior')
    .replace(/^EXPERT$/i, 'Expert')
}

function parcoursFromCatalog(catalogKey) {
  const groups = CATALOG[catalogKey]
  if (!Array.isArray(groups)) return null

  const levels = groups
    .map((g) => g.level)
    .filter((l) => l && !SKIP_LEVEL.test(l))
    .map(formatLevelLabel)

  return levels.length ? levels.join(' → ') : null
}

/**
 * Parcours de niveaux pour la pastille meta (détail public par marque).
 * @param {string} publicName
 * @param {string} [brandSlug]
 */
export function getPublicBrandParcours(publicName, brandSlug) {
  if (!brandSlug) return null

  if (PARCOURS_OVERRIDE_BY_SLUG[brandSlug]) {
    return PARCOURS_OVERRIDE_BY_SLUG[brandSlug]
  }

  const catalogKey = SLUG_TO_CATALOG_KEY[brandSlug]
  if (!catalogKey) return null

  if (catalogKey === 'CARROSSERIE') {
    return PARCOURS_OVERRIDE_BY_SLUG.carrosserie
  }

  return parcoursFromCatalog(catalogKey)
}
