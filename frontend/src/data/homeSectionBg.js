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

/** Ordre scroll + fond fixe Netflix (crossfade). */
const HOME_BACKDROP_ITEMS = [
  { id: 'actualites', image: HOME_SECTION_BG.actualites },
  { id: 'publics', image: HOME_SECTION_BG.publics },
  { id: 'offres', image: HOME_SECTION_BG.motors },
  { id: 'formations-equipment', image: HOME_SECTION_BG.equipment },
  { id: 'formations-carrosserie', image: HOME_SECTION_BG.carrosserie },
  { id: 'formations-sav-motors', image: HOME_SECTION_BG.savMotors, position: HOME_SECTION_BG_POSITION.savMotors },
  { id: 'formations-sav-equipment', image: HOME_SECTION_BG.savEquipment },
  { id: 'sessions', image: HOME_SECTION_BG.sessions },
  { id: 'expertise', image: HOME_SECTION_BG.academy },
  { id: 'temoignages', image: HOME_SECTION_BG.testimonials },
  { id: 'cta-contact', image: HOME_SECTION_BG.cta, position: HOME_SECTION_BG_POSITION.cta },
]
export const HOME_BACKDROP_SECTIONS = HOME_SESSIONS_SECTION_VISIBLE
  ? HOME_BACKDROP_ITEMS
  : HOME_BACKDROP_ITEMS.filter((s) => s.id !== 'sessions')

export const HOME_BACKDROP_SECTION_IDS = HOME_BACKDROP_SECTIONS.map((s) => s.id)
