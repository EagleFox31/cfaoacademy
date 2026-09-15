/**
 * Couleurs de marque pour teinter la page de saisie.
 *
 * Sources (dans cet ordre) :
 *   1. Accents vitrine documentés (`DESIGN_SYSTEM.md` § cartes) — Toyota, Mercedes, Suzuki
 *   2. Bandeau titre des fiches PNG `catalogues/<marque>/` — Equipment + BYD
 *   3. Teinte constructeur usuelle pour le reste (Motors hors fiche grise)
 *
 * Une marque absente retombe sur le rouge Academy.
 */

const BRAND_COLORS = {
  // Vitrine / DESIGN_SYSTEM
  toyota: '#EB0A1E',
  suzuki: '#004b9e',
  mercedes: '#333333',

  // Motors — teinte constructeur (sauf BYD = gris fiches)
  byd: '#6B7280',
  mitsubishi: '#E60012',
  peugeot: '#1C1F2A',
  citroen: '#E4002B',
  fiat: '#AD172B',
  jeep: '#1B4D3E',
  'omoda-jaecoo': '#C4A265',
  yamaha: '#0047AB',

  // Equipment — bandeau titre des fiches catalogue
  jcb: '#F8BD04',
  lovol: '#FFCC00',
  bt: '#E60838',
  'toyota-forklift': '#E26C09',
  hino: '#757675',
  fuso: '#E60012',
  'renault-trucks': '#6B6B6B',
  sinotruk: '#006666',
  shacman: '#2E5395',
  'king-long': '#757675',
}

/** Texte lisible sur la teinte (jaunes / gris clairs / ors → encre foncée). */
const DARK_ON = new Set([
  'jcb',
  'lovol',
  'hino',
  'king-long',
  'omoda-jaecoo',
])

function hexToRgb(hex) {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const n = Number.parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function brandTheme(code) {
  const key = String(code || '').toLowerCase()
  const accent = BRAND_COLORS[key] || '#E3001B'
  const { r, g, b } = hexToRgb(accent)
  return {
    accent,
    soft: `rgba(${r}, ${g}, ${b}, 0.12)`,
    softStrong: `rgba(${r}, ${g}, ${b}, 0.22)`,
    onAccent: DARK_ON.has(key) ? '#1a1f3c' : '#ffffff',
    css: {
      '--brand': accent,
      '--brand-soft': `rgba(${r}, ${g}, ${b}, 0.12)`,
      '--brand-soft-strong': `rgba(${r}, ${g}, ${b}, 0.22)`,
      '--brand-on': DARK_ON.has(key) ? '#1a1f3c' : '#ffffff',
    },
  }
}

/** Accents exportés pour le design system / audits — ne pas dupliquer ailleurs. */
export const BRAND_ACCENTS = { ...BRAND_COLORS }
