/** Fonds photo accueil — un seul fond fixe pour toute la landing (lisibilité publique). */
import { HOME_SESSIONS_SECTION_VISIBLE } from './index.js'

/** Image unique derrière toutes les sections (hors hero). */
export const HOME_LANDING_BG = '/assets/cfao-academy-douala.jpg'
export const HOME_LANDING_BG_POSITION = 'center'
export const HOME_LANDING_VEIL = 'light'

/** @deprecated Conservé pour refs éventuelles ; le scroll utilise HOME_LANDING_BG. */
export const HOME_SECTION_BG = {
  actualites: HOME_LANDING_BG,
  publics: HOME_LANDING_BG,
  motors: HOME_LANDING_BG,
  equipment: HOME_LANDING_BG,
  carrosserie: HOME_LANDING_BG,
  savMotors: HOME_LANDING_BG,
  savEquipment: HOME_LANDING_BG,
  sessions: HOME_LANDING_BG,
  academy: HOME_LANDING_BG,
  testimonials: HOME_LANDING_BG,
  cta: HOME_LANDING_BG,
}

/** Visuel cartes formations carrosserie (accueil) — `assets/carrossier_peintre.jpg` */
export const CARROSSERIE_CARD_IMG = '/assets/carrossier_peintre.jpg'

export const HOME_SECTION_BG_POSITION = {
  cta: HOME_LANDING_BG_POSITION,
}

/** Voile unique light — évite l’alternance clair/navy qui embrouille le public. */
export const HOME_SECTION_VEIL = {
  actualites: HOME_LANDING_VEIL,
  publics: HOME_LANDING_VEIL,
  offres: HOME_LANDING_VEIL,
  'formations-equipment': HOME_LANDING_VEIL,
  'formations-carrosserie': HOME_LANDING_VEIL,
  'formations-sav-motors': HOME_LANDING_VEIL,
  'formations-sav-equipment': HOME_LANDING_VEIL,
  sessions: HOME_LANDING_VEIL,
  expertise: HOME_LANDING_VEIL,
  assistance: 'dark',
  temoignages: HOME_LANDING_VEIL,
  'cta-contact': HOME_LANDING_VEIL,
}

/** Ordre scroll (section active / snap) — même fond pour chaque id. */
const HOME_BACKDROP_ITEMS = [
  { id: 'actualites', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'publics', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'offres', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'formations-equipment', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'formations-carrosserie', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'formations-sav-motors', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'formations-sav-equipment', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'sessions', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'expertise', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'assistance', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: 'dark' },
  { id: 'temoignages', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
  { id: 'cta-contact', image: HOME_LANDING_BG, position: HOME_LANDING_BG_POSITION, veil: HOME_LANDING_VEIL },
]
export const HOME_BACKDROP_SECTIONS = HOME_SESSIONS_SECTION_VISIBLE
  ? HOME_BACKDROP_ITEMS
  : HOME_BACKDROP_ITEMS.filter((s) => s.id !== 'sessions')

export const HOME_BACKDROP_SECTION_IDS = HOME_BACKDROP_SECTIONS.map((s) => s.id)

const HOME_BACKDROP_BY_ID = Object.fromEntries(
  HOME_BACKDROP_SECTIONS.map((s) => [
    s.id,
    { image: s.image, position: s.position ?? 'center', veil: s.veil ?? HOME_LANDING_VEIL },
  ]),
)

/**
 * Résout le fond d'une section (landing = toujours le même visuel).
 * @param {string} id
 * @returns {{ image: string, position: string, veil: string } | null}
 */
export function resolveSectionBackdrop(id) {
  return HOME_BACKDROP_BY_ID[id] ?? null
}
