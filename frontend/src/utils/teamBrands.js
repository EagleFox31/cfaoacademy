import { BRANDS } from '../data/index.js'

const logoByName = new Map(
  BRANDS.filter((b) => b.logo).map((b) => [b.name.toLowerCase(), b.logo]),
)

/** Clés JSON → libellé + logo (assets/logos). */
export const TEAM_BRAND_DEFS = {
  'toutes-marques': { label: 'Toutes marques', logo: null, isAllBrands: true },
  toyota: { label: 'Toyota', logo: logoByName.get('toyota') },
  suzuki: { label: 'Suzuki', logo: logoByName.get('suzuki') },
  byd: { label: 'BYD', logo: logoByName.get('byd') },
  'mercedes-benz': { label: 'Mercedes-Benz', logo: logoByName.get('mercedes-benz') },
  mitsubishi: { label: 'Mitsubishi', logo: logoByName.get('mitsubishi') },
  omoda: { label: 'Omoda & Jaecoo', logo: logoByName.get('omoda & jaecoo') },
  stellantis: { label: 'Stellantis', logo: logoByName.get('stellantis') },
  'renault-trucks': { label: 'Renault Trucks', logo: logoByName.get('renault trucks') },
  hino: { label: 'Hino', logo: logoByName.get('hino') },
  fuso: { label: 'Fuso', logo: logoByName.get('fuso') },
  sinotruk: { label: 'Sinotruk', logo: logoByName.get('sinotruk') },
  'king-long': { label: 'King Long', logo: logoByName.get('king long') },
  bt: { label: 'BT', logo: logoByName.get('bt') },
  'toyota-forklift': { label: 'Toyota', logo: logoByName.get('toyota material') },
  jcb: { label: 'JCB', logo: logoByName.get('jcb') },
  lovol: { label: 'Lovol', logo: logoByName.get('lovol') },
  yamaha: { label: 'Yamaha', logo: logoByName.get('yamaha') },
  carrosserie: { label: 'Carrosserie', logo: null },
  process: { label: 'Process', logo: null },
}

export function resolveTeamBrands(brandIds = []) {
  return brandIds
    .map((id) => {
      const def = TEAM_BRAND_DEFS[id]
      if (!def) return null
      return { id, label: def.label, logo: def.logo }
    })
    .filter(Boolean)
}
