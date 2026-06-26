/** Fonds photo par section accueil (hors hero carrousel). */
import { HOME_SESSIONS_SECTION_VISIBLE } from './index.js'

export const HOME_SECTION_BG = {
  actualites: '/assets/images_articles/event_academy.jpg',
  publics: '/assets/publics/commerciaux.jpg',
  motors: '/assets/images_articles/formation_toyota_g3.jpg',
  equipment: '/assets/images_articles/event_lovol.jpg',
  carrosserie: '/assets/images_articles/event_carrosserie.jpg',
  savMotors: '/assets/hero/cta_hover_sav.jpg',
  savEquipment: '/assets/publics/parts.jpg',
  sessions: '/assets/images_articles/cert_toyota.jpg',
  academy: '/assets/dernière_section_accueil/andragogie.jpg',
  testimonials: '/assets/images_articles/cert_suzuki.jpg',
  cta: '/assets/cfao-academy-douala.jpg',
}

/** Visuel cartes formations carrosserie (accueil) — `assets/carrossier_peintre.jpg` */
export const CARROSSERIE_CARD_IMG = '/assets/carrossier_peintre.jpg'

/** Cadrage optionnel — reprend les réglages hero quand pertinent. */
export const HOME_SECTION_BG_POSITION = {
  savMotors: '68% 10%',
  cta: 'center',
}

/** Voile mixte par section (light = fond clair, dark = fond navy, light-soft = photo très visible). */
export const HOME_SECTION_VEIL = {
  actualites: 'light',
  publics: 'dark',
  offres: 'light',
  'formations-equipment': 'dark',
  'formations-carrosserie': 'light-soft',
  'formations-sav-motors': 'dark',
  'formations-sav-equipment': 'light',
  sessions: 'dark',
  expertise: 'light',
  temoignages: 'dark',
  'cta-contact': 'light',
}

/** Ordre scroll + fond fixe Netflix (crossfade). */
const HOME_BACKDROP_ITEMS = [
  { id: 'actualites', image: HOME_SECTION_BG.actualites, veil: HOME_SECTION_VEIL.actualites },
  { id: 'publics', image: HOME_SECTION_BG.publics, veil: HOME_SECTION_VEIL.publics },
  { id: 'offres', image: HOME_SECTION_BG.motors, veil: HOME_SECTION_VEIL.offres },
  { id: 'formations-equipment', image: HOME_SECTION_BG.equipment, veil: HOME_SECTION_VEIL['formations-equipment'] },
  { id: 'formations-carrosserie', image: HOME_SECTION_BG.carrosserie, veil: HOME_SECTION_VEIL['formations-carrosserie'] },
  { id: 'formations-sav-motors', image: HOME_SECTION_BG.savMotors, position: HOME_SECTION_BG_POSITION.savMotors, veil: HOME_SECTION_VEIL['formations-sav-motors'] },
  { id: 'formations-sav-equipment', image: HOME_SECTION_BG.savEquipment, veil: HOME_SECTION_VEIL['formations-sav-equipment'] },
  { id: 'sessions', image: HOME_SECTION_BG.sessions, veil: HOME_SECTION_VEIL.sessions },
  { id: 'expertise', image: HOME_SECTION_BG.academy, veil: HOME_SECTION_VEIL.expertise },
  { id: 'temoignages', image: HOME_SECTION_BG.testimonials, veil: HOME_SECTION_VEIL.temoignages },
  { id: 'cta-contact', image: HOME_SECTION_BG.cta, position: HOME_SECTION_BG_POSITION.cta, veil: HOME_SECTION_VEIL['cta-contact'] },
]
export const HOME_BACKDROP_SECTIONS = HOME_SESSIONS_SECTION_VISIBLE
  ? HOME_BACKDROP_ITEMS
  : HOME_BACKDROP_ITEMS.filter((s) => s.id !== 'sessions')

export const HOME_BACKDROP_SECTION_IDS = HOME_BACKDROP_SECTIONS.map((s) => s.id)

/** Index id → { image, position, veil } — source unique pour le fond Netflix d'une section. */
const HOME_BACKDROP_BY_ID = Object.fromEntries(
  HOME_BACKDROP_SECTIONS.map((s) => [
    s.id,
    { image: s.image, position: s.position ?? 'center', veil: s.veil ?? 'light' },
  ]),
)

/**
 * Résout automatiquement le fond d'une section à partir de son `id`.
 * Évite les appels inline `sectionBg={...}` dispersés dans les pages.
 * @param {string} id
 * @returns {{ image: string, position: string, veil: string } | null}
 */
export function resolveSectionBackdrop(id) {
  return HOME_BACKDROP_BY_ID[id] ?? null
}
