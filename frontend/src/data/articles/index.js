import { fmtNewsDate } from '../index.js'

const modules = import.meta.glob('./*.json', { eager: true })

const EQUIPMENT = new Set([
  'SINOTRUK', 'LOVOL', 'HINO', 'FUSO', 'RENAULT TRUCKS', 'JCB', 'KING LONG',
  'BT', 'SHACMAN', 'MERCEDES TRUCKS', 'TOYOTA FORKLIFT', 'TOYOTA MATERIAL',
])

function deriveBu(brand, titre = '') {
  const t = titre.toLowerCase()
  if (/carrosserie/.test(t)) return 'Carrosserie'
  if (/parts|process|ftir|ftr/.test(t)) return 'Parts Motors'
  if (!brand) {
    if (/equipment|lovol|jcb|sinotruk|engins|chariot/.test(t)) return 'Equipment'
    return 'Motors'
  }
  const b = brand.toUpperCase()
  if (b === 'CARROSSERIE') return 'Carrosserie'
  if (EQUIPMENT.has(b) || [...EQUIPMENT].some((e) => b.includes(e))) return 'Equipment'
  return 'Motors'
}

function normalize(raw) {
  const photos = raw.photos?.urls ?? []
  const videos = raw.videos?.urls ?? []
  return {
    slug: raw.id,
    category: raw.cat,
    date: raw.date,
    dateLabel: fmtNewsDate(raw.date),
    brand: raw.brand ?? null,
    tone: raw.tone ?? 't1',
    title: raw.titre,
    summary: raw.resume,
    readTime: raw.readtime ?? null,
    views: raw.views ?? 0,
    content: raw.contenu ?? '',
    cover: raw.cover ?? null,
    photos,
    videos,
    bu: deriveBu(raw.brand, raw.titre),
  }
}

export const ARTICLES = Object.entries(modules)
  .filter(([path]) => !path.includes('_schema'))
  .map(([, mod]) => normalize(mod.default ?? mod))
  .sort((a, b) => b.date.localeCompare(a.date))

export function getArticle(slug) {
  return ARTICLES.find((a) => a.slug === slug)
}

export function catSlug(cat) {
  return cat
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '-')
}

export { fmtNewsDate }
