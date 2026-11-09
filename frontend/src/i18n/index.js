import { NOT_FOUND_COPY } from './notFound.js'
import { COMMON_COPY } from './common.js'
import {
  ACADEMY_PANELS_COPY,
  ACADEMY_UI_COPY,
  EQUIPE_MEMBERS_COPY,
  EQUIPE_POLES_COPY,
} from './academyPanels.js'
import { ACADEMY_COPY } from './academy.js'
import { ARTICLE_PAGE_COPY } from './articlePage.js'
import { ARTICLES_COPY } from './articles.js'
import { BRANDS_COPY } from './brands.js'
import { CARDS_COPY } from './cards.js'
import { COUNTRIES_COPY, REGIONS_COPY } from './countries.js'
import { CONTACT_COPY } from './contact.js'
import { CTA_COPY } from './cta.js'
import { FICHE_COPY } from './fiche.js'
import { FOOTER_COPY } from './footer.js'
import { HERO_COPY } from './hero.js'
import { HOME_COPY } from './home.js'
import { LOGIN_COPY } from './login.js'
import { MARQUEE_COPY } from './marquee.js'
import { PORTAL_COPY } from './portal.js'
import { DELIVERY_COPY } from './delivery.js'
import { COST_KEY_COPY } from './costKey.js'
import { SHEET_COPY } from './sheet.js'
import { NAV_COPY } from './nav.js'
import { OFFERS_COPY } from './offers.js'
import { LEGAL_COPY } from './legal.js'
import { PRIVACY_COPY } from './privacy.js'
import { PUBLICS_COPY } from './publics.js'
import { SESSIONS_COPY } from './sessions.js'
import { SESSION_TITLES_COPY } from './sessionTitles.js'
import { CATALOG_LABELS_COPY } from './catalogLabels.js'
import { ELEARNING_TITLES_COPY } from './elearningTitles.js'
import { TESTIMONIALS_COPY } from './testimonials.js'

export const LOCALES = ['fr', 'en', 'pt']
export const DEFAULT_LOCALE = 'fr'

const SECTIONS = {
  common: COMMON_COPY,
  nav: NAV_COPY,
  login: LOGIN_COPY,
  home: HOME_COPY,
  hero: HERO_COPY,
  cta: CTA_COPY,
  footer: FOOTER_COPY,
  cards: CARDS_COPY,
  publics: PUBLICS_COPY,
  articles: ARTICLES_COPY,
  academy: ACADEMY_COPY,
  academyUi: ACADEMY_UI_COPY,
  academyPanels: ACADEMY_PANELS_COPY,
  equipePoles: EQUIPE_POLES_COPY,
  equipeMembers: EQUIPE_MEMBERS_COPY,
  offers: OFFERS_COPY,
  testimonials: TESTIMONIALS_COPY,
  brands: BRANDS_COPY,
  sessionTitles: SESSION_TITLES_COPY,
  catalogLabels: CATALOG_LABELS_COPY,
  elearningTitles: ELEARNING_TITLES_COPY,
  sessions: SESSIONS_COPY,
  countries: COUNTRIES_COPY,
  regions: REGIONS_COPY,
  fiche: FICHE_COPY,
  articlePage: ARTICLE_PAGE_COPY,
  contact: CONTACT_COPY,
  privacy: PRIVACY_COPY,
  legal: LEGAL_COPY,
  marquee: MARQUEE_COPY,
  portal: PORTAL_COPY,
  delivery: DELIVERY_COPY,
  costKey: COST_KEY_COPY,
  sheet: SHEET_COPY,
  notFound: NOT_FOUND_COPY,
}

export function getCopy(section, locale = DEFAULT_LOCALE) {
  const catalog = SECTIONS[section]
  if (!catalog) return {}
  return catalog[locale] ?? catalog[DEFAULT_LOCALE] ?? {}
}
