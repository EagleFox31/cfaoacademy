import { HERO_PERSONA_IDS } from '../i18n/hero.js'

export const HERO_DEFAULT = '/assets/hero/default.jpg'

export const HERO_IMAGES = {
  default: HERO_DEFAULT,
  vl: '/assets/hero/cta_hover_vl.jpg',
  pl: '/assets/hero/cta_hover_pl.jpg',
  carrossier: '/assets/hero/cta_hover_carrosserie.png',
  savParts: '/assets/hero/cta_hover_sav.jpg',
  b2b: '/assets/hero/cta_hover_b2b.jpg',
}

export const HERO_BG_POSITION = {
  default: '58% top',
  vl: '70% 8%',
  pl: '74% 5%',
  carrossier: '78% 6%',
  savParts: '68% 10%',
  b2b: '58% top',
}

export const HERO_VISUAL_IDS = ['default', ...HERO_PERSONA_IDS, 'b2b']

export const HERO_BACKDROP_VISUALS = HERO_VISUAL_IDS.map((id) => ({
  id,
  image: HERO_IMAGES[id] ?? HERO_DEFAULT,
  position: HERO_BG_POSITION[id] ?? HERO_BG_POSITION.default,
}))
