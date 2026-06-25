import { BRANDS } from '../data/index.js'

const BRAND_LOGOS = Object.fromEntries(
  BRANDS.filter((b) => b.logo).map((b) => [b.name.toUpperCase(), b.logo]),
)

const LOGO_ALIASES = {
  'MERCEDES-BENZ': 'MERCEDES-BENZ',
  MERCEDES: 'MERCEDES-BENZ',
  'OMODA & JAECCO': 'OMODA & JAECCO',
  'OMODA-JAECCO': 'OMODA & JAECCO',
  'OMODA-JAECOO': 'OMODA & JAECCO',
  'TOYOTA FORKLIFT': 'TOYOTA MATERIAL',
  'TOYOTA-FORKLIFT': 'TOYOTA MATERIAL',
  'TOYOTA MATERIAL': 'TOYOTA MATERIAL',
  'RENAULT TRUCKS': 'RENAULT TRUCKS',
  'RENAULT-TRUCKS': 'RENAULT TRUCKS',
  'KING LONG': 'KING LONG',
  'KING-LONG': 'KING LONG',
  'MERCEDES TRUCKS': 'MERCEDES TRUCKS',
}

const TEXT_LABELS = {
  'TOUTES MARQUES': 'Toutes marques',
  'TOUTES MARQUES VL': 'Toutes marques',
  CARROSSERIE: 'Carrosserie',
  'PROCESS SAV': 'Process SAV',
  'PROCESS SAV & PARTS': 'Process SAV',
  'PARTS & PROCESS': 'Parts & Process',
  'PARTS & PROCESS MOTORS': 'SAV Motors',
  'PARTS & PROCESS EQUIPMENT': 'SAV Equipment',
  'RENAULT-TRUCKS': 'Renault Trucks',
  'KING-LONG': 'King Long',
  'TOYOTA-FORKLIFT': 'Toyota Material',
  'OMODA-JAECCO': 'Omoda & Jaecoo',
  'OMODA-JAECOO': 'Omoda & Jaecoo',
}

const BU_BADGE = {
  Carrosserie: 'Carrosserie',
  'Parts Motors': 'SAV Motors',
  Equipment: 'Equipment',
  Motors: 'Toutes marques',
}

function norm(s) {
  return (s ?? '').trim().toUpperCase()
}

function lookupLogo(raw) {
  if (!raw) return null
  const key = norm(raw)
  const spaced = key.replace(/-/g, ' ')
  const alias = LOGO_ALIASES[key] ?? LOGO_ALIASES[spaced] ?? key
  return (
    BRAND_LOGOS[alias]
    ?? BRAND_LOGOS[spaced]
    ?? BRAND_LOGOS[alias.split(' ')[0]]
    ?? null
  )
}

function formatTextLabel(raw) {
  const key = norm(raw)
  if (TEXT_LABELS[key]) return TEXT_LABELS[key]
  if (key.startsWith('TOUTES MARQUES')) return 'Toutes marques'
  if (key.includes('CARROSSERIE')) return 'Carrosserie'
  if (/PROCESS/.test(key) && /SAV|PARTS/.test(key)) return 'Process SAV'

  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** @returns {{ logo?: string, label?: string }} */
export function resolveCardBrandBadge(brandOrMarque, ctx = {}) {
  const raw = brandOrMarque?.trim()
  if (raw) {
    const logo = lookupLogo(raw)
    if (logo) return { logo }
    return { label: formatTextLabel(raw) }
  }

  const { tagClass, bu } = ctx
  if (tagClass === 'carrosserie' || bu?.includes('Carrosserie')) {
    return { label: 'Carrosserie' }
  }
  if (tagClass === 'parts-motors' || bu?.includes('Parts & Process Motors')) {
    return { label: 'SAV Motors' }
  }
  if (tagClass === 'parts-eq' || bu?.includes('Parts & Process Equipment')) {
    return { label: 'SAV Equipment' }
  }

  return {}
}

export function resolveSessionCardBadge(session) {
  return resolveCardBrandBadge(session.marque, {
    tagClass: session.tagClass,
    bu: session.bu,
  })
}

export function resolveArticleCardBadge(article) {
  if (article.brand) return resolveCardBrandBadge(article.brand)
  return { label: BU_BADGE[article.bu] ?? 'Academy' }
}
