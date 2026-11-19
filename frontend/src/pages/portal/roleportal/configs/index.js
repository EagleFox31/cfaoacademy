/**
 * Portails décrits par configuration (fabrique), par rôle.
 * Un rôle absent d'ici garde sa page écrite à la main.
 */
import trainer from './trainer.js'
import consultation from './consultation.js'
import { CONSULTATION_MODES } from '../../portalProfiles.js'

export const PORTAL_CONFIGS = {
  trainer,
  // Un seul portail de consultation, décliné par rôle (mode = rôle).
  ...Object.fromEntries(Object.keys(CONSULTATION_MODES).map(role => [role, consultation])),
}
