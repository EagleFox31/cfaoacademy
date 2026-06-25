/** Fonds section Motors (#offres) au survol d’une carte marque — `assets/hover_section_motors/`. */
export const MOTORS_SECTION_HOVER_BG = {
  Toyota: '/assets/hover_section_motors/01_hover_toyota_bg.png',
  'Mercedes-Benz': '/assets/hover_section_motors/02_hover_mercedes_bg.png',
  Suzuki: '/assets/hover_section_motors/03_hover_suzuki_bg.png',
  BYD: '/assets/hover_section_motors/04_hover_byd_bg.png',
  Mitsubishi: '/assets/hover_section_motors/05_hover_mitsubishi_bg.png',
  'Omoda & Jaecoo': '/assets/hover_section_motors/06_hover_omoda_jaecoo_bg.png',
  Stellantis: '/assets/hover_section_motors/07_hover_stellantis_bg.png',
  Yamaha: '/assets/hover_section_motors/08_hover_yamaha_bg.png',
}

export function getMotorsSectionHoverBg(brandName) {
  return MOTORS_SECTION_HOVER_BG[brandName] ?? null
}
