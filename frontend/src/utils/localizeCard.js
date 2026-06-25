import { getCopy } from '../i18n/index.js'
import { ARTICLE_BODIES } from '../i18n/articleBodies.js'
import { NEWS_TAB_KEYS } from '../i18n/home.js'
import { getFormationFicheTitle } from './formationFiche.js'
import { getPublicFormationCount } from './publicFormationCount.js'
import { canonicalTrainingCode } from './trainingCode.js'
import { resolveCardBrandBadge, resolveArticleCardBadge } from './cardBrandBadge.js'

const BADGE_LABEL_KEYS = {
  'Toutes marques': 'allBrands',
  Carrosserie: 'bodywork',
  'SAV Motors': 'savMotors',
  'SAV Equipment': 'savEquipment',
  'Process SAV': 'processSav',
  'Parts & Process': 'partsProcess',
  Techniciens: 'technicians',
  Equipment: 'equipment',
  Academy: 'academy',
}

const MONTHS_SHORT = {
  fr: ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOUT', 'SEPT', 'OCT', 'NOV', 'DEC'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  pt: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
}

export function fmtDayLocale(dateStr, locale = 'fr') {
  const d = new Date(dateStr)
  const months = MONTHS_SHORT[locale] ?? MONTHS_SHORT.fr
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mo: months[d.getMonth()],
    year: d.getFullYear(),
  }
}

export function fmtNewsDateLocale(dateStr, locale = 'fr') {
  const { day, mo, year } = fmtDayLocale(dateStr, locale)
  return `${day} ${mo} ${year}`
}

export function localizedArticleCategory(category, locale = 'fr') {
  const home = getCopy('home', locale)
  const key = NEWS_TAB_KEYS[category]
  return key ? home[key] ?? category : category
}

export function localizedArticleFields(article, locale = 'fr') {
  if (locale === 'fr') {
    return {
      categoryLabel: article.category,
      title: article.title,
      summary: article.summary,
      dateLabel: article.dateLabel,
      content: article.content,
    }
  }
  const entry = getCopy('articles', locale)[article.slug] ?? {}
  const body = ARTICLE_BODIES[locale]?.[article.slug]
  return {
    categoryLabel: localizedArticleCategory(article.category, locale),
    title: entry.title ?? article.title,
    summary: entry.summary ?? article.summary,
    dateLabel: fmtNewsDateLocale(article.date, locale),
    content: body ?? article.content,
  }
}

export function localizedPublicFields(pub, locale = 'fr') {
  if (locale === 'fr') {
    return { name: pub.name, meta: pub.meta, niv: pub.niv }
  }
  const entry = getCopy('publics', locale)[pub.name] ?? {}
  return {
    name: entry.name ?? pub.name,
    meta: entry.meta ?? pub.meta,
    niv: entry.niv ?? pub.niv,
  }
}

export function localizedAcademyPreview(item, locale = 'fr') {
  if (locale === 'fr') return item
  const entry = getCopy('academy', locale)[item.tab] ?? {}
  return {
    ...item,
    kicker: entry.kicker ?? item.kicker,
    title: entry.panelTitle ?? entry.title ?? item.title,
    meta: entry.meta ?? item.meta,
  }
}

export function localizedOfferFields(offerId, offer, locale = 'fr') {
  if (locale === 'fr') return offer
  const entry = getCopy('offers', locale)[offerId] ?? {}
  return {
    ...offer,
    kicker: entry.kicker ?? offer.kicker,
    title: entry.title ?? offer.title,
    meta: entry.meta ?? offer.meta,
  }
}

export function localizedBrandCat(brand, locale = 'fr') {
  if (locale === 'fr') return brand.cat
  return getCopy('brands', locale)[brand.name] ?? brand.cat
}

export function localizedSessionTitle(session, locale = 'fr') {
  if (locale === 'fr') return getFormationFicheTitle(session)
  const code = canonicalTrainingCode(session?.code)
  const titles = getCopy('sessionTitles', locale)
  return titles[code] ?? titles[session?.code] ?? getFormationFicheTitle(session)
}

/** Titre module e-learning — FR depuis le catalogue JSON, EN depuis i18n/elearningTitles.js */
export function localizedElearningTitle(item, locale = 'fr') {
  const fallback = item?.title ?? item?.code ?? ''
  if (locale === 'fr') return fallback
  const code = item?.code ?? ''
  const titles = getCopy('elearningTitles', locale)
  return titles[code] ?? fallback
}

export function formatPublicKicker(niv, publicName, locale = 'fr') {
  const cards = getCopy('cards', locale)
  const count = getPublicFormationCount(publicName)
  if (count <= 0) return niv
  const label = count > 1 ? cards.formationPlural : cards.formationSingular
  return `${niv} · ${count} ${label}`
}

function stripAccents(s) {
  return (s ?? '').normalize('NFD').replace(/\p{M}/gu, '')
}

export function localizedCatalogType(type, locale = 'fr') {
  if (!type || locale === 'fr') return type
  const cards = getCopy('cards', locale)
  const t = stripAccents(type).toLowerCase()
  if (t.includes('distanciel')) return cards.remote
  if (t.includes('presentiel')) return cards.onsite
  return type
}

export function localizedCatalogDuration(duration, locale = 'fr') {
  if (!duration || locale === 'fr') return duration
  const cards = getCopy('cards', locale)
  const labels = getCopy('catalogLabels', locale)
  const eachSuffix = /chacune/i.test(duration) ? ` ${labels.durationEach ?? 'each'}` : ''
  const m = duration.match(/(\d+)\s*jours?/i)
  if (!m) return duration
  const n = parseInt(m[1], 10)
  const unit = n > 1 ? cards.days : cards.day
  return `${n} ${unit}${eachSuffix}`
}

export function localizedCatalogPublic(publicStr, locale = 'fr') {
  if (!publicStr || locale === 'fr') return publicStr
  const map = getCopy('catalogLabels', locale).public ?? {}
  if (map[publicStr]) return map[publicStr]
  return publicStr
}

export function localizedCatalogTrainingTitle(training, locale = 'fr') {
  if (!training) return ''
  if (locale === 'fr') return training.name?.trim() || training.code || ''
  const code = canonicalTrainingCode(training.code)
  const titles = getCopy('sessionTitles', locale)
  return (
    titles[code]
    ?? titles[training.code]
    ?? (locale === 'en' ? training.englishName : null)
    ?? training.name?.trim()
    ?? training.code
    ?? ''
  )
}

/** Champs localisés pour cartes catalogue (process, carrosserie, technique). */
export function localizedCatalogTrainingFields(training, locale = 'fr', { level } = {}) {
  const title = localizedCatalogTrainingTitle(training, locale)
  const type = localizedCatalogType(training.type, locale)
  const duration = localizedCatalogDuration(training.duration, locale)
  const publicLabel = training.public
    ? localizedCatalogPublic(training.public, locale)
    : localizedCatalogPublic('Techniciens', locale)
  const kicker = level
    ? [level, type].filter(Boolean).join(' · ')
    : [type, duration].filter(Boolean).join(' · ')
  const meta = `${training.code} · ${publicLabel}`
  return { title, type, duration, public: publicLabel, kicker, meta }
}

export function localizedCardBrandBadge(brandOrMarque, ctx = {}, locale = 'fr') {
  const badge = resolveCardBrandBadge(brandOrMarque, ctx)
  if (!badge.label || locale === 'fr') return badge
  const badges = getCopy('catalogLabels', locale).badges ?? {}
  const key = BADGE_LABEL_KEYS[badge.label]
  if (key && badges[key]) return { ...badge, label: badges[key] }
  const raw = (brandOrMarque ?? badge.label ?? '').trim().toUpperCase()
  if (raw.startsWith('TOUTES MARQUES') && badges.allBrands) {
    return { ...badge, label: badges.allBrands }
  }
  if (raw.includes('CARROSSERIE') && badges.bodywork) {
    return { ...badge, label: badges.bodywork }
  }
  return badge
}

/** Badge BU sur cartes / en-tête article (Motors, Carrosserie, Equipment…). */
export function localizedArticleCardBadge(article, locale = 'fr') {
  const badge = resolveArticleCardBadge(article)
  if (!badge.label || badge.logo || locale === 'fr') return badge
  return localizedCardBrandBadge(badge.label, {}, locale)
}
