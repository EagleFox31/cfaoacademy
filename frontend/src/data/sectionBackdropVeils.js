/**
 * Voiles mixtes — dégradé global HomeBackdrop + ::after des sections.
 */
export const SECTION_VEIL = {
  light: {
    active: 'rgba(255, 255, 255, 0.36)',
    idle: 'rgba(255, 255, 255, 0.54)',
    backdropClass: 'home-backdrop-veil--light',
  },
  dark: {
    active: 'rgba(26, 31, 60, 0.38)',
    idle: 'rgba(26, 31, 60, 0.54)',
    backdropClass: 'home-backdrop-veil--dark',
  },
  'light-soft': {
    active: 'rgba(255, 255, 255, 0.28)',
    idle: 'rgba(255, 255, 255, 0.46)',
    backdropClass: 'home-backdrop-veil--light',
  },
}

/** @param {string} [key] @returns {keyof typeof SECTION_VEIL} */
export function normalizeSectionVeil(key) {
  return key && SECTION_VEIL[key] ? key : 'light'
}

/** @param {string} [veilKey] @param {{ active?: boolean }} [opts] */
export function sectionVeilColor(veilKey, { active = false } = {}) {
  const preset = SECTION_VEIL[normalizeSectionVeil(veilKey)]
  return active ? preset.active : preset.idle
}

export function sectionVeilBackdropClass(veilKey) {
  return SECTION_VEIL[normalizeSectionVeil(veilKey)].backdropClass
}
