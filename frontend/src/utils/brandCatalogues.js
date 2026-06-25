import { cataloguePdfUrl } from './cataloguePdf.js'

/** Dossiers `catalogues/<marque>/` — PDF catalogue technique par marque (2026). */
const COMING_SOON_BRANDS = new Set(['Mercedes Trucks', 'Yamaha'])

const BRAND_CATALOGUES = {
  'Toyota': {
    folder: 'toyota',
    file: 'Catalogue Formation Technique TOYOTA 2026 V2.pdf',
    fileEn: 'TOYOTA Technical training catalogue 2026 v1.pdf',
  },
  'Mercedes-Benz': {
    folder: 'mercedes',
    file: 'Catalogue Formation Technique MERCEDES 2026.pdf',
    fileEn: 'MERCEDES Technical Training catalogue 2026 v1.pdf',
  },
  'Suzuki': {
    folder: 'suzuki',
    file: 'Catalogue Formation Technique SUZUKI 2026.pdf',
    fileEn: 'SUZUKI Technical Training Catalogue 2026 v1.pdf',
  },
  'BYD': {
    folder: 'byd',
    file: 'Catalogue Formation Technique BYD 2026.pdf',
    fileEn: 'BYD Technical training Catalogue 2026 v1.pdf',
  },
  'Mitsubishi': {
    folder: 'mitsubishi',
    file: 'Offre de Formation Technique MITSUBISHI 2026.pdf',
  },
  'Omoda & Jaecoo': {
    folder: 'omoda-jaecco',
    file: 'Catalogue Formation Technique OMODA JAECOO 2026.pdf',
    fileEn: 'OMODAJAECOO Technical Training Catalogue 2026 v1.pdf',
  },
  'Stellantis': {
    folder: 'stellantis',
    file: 'Catalogue Formation Technique STELLANTIS 2026.pdf',
    fileEn: 'STELLANTIS Technical Training Catalogue 2026 v1.pdf',
  },
  'Citroën': {
    folder: 'stellantis',
    file: 'Catalogue Formation Technique STELLANTIS 2026.pdf',
    fileEn: 'STELLANTIS Technical Training Catalogue 2026 v1.pdf',
  },
  'Renault Trucks': {
    folder: 'renault trucks',
    file: 'Catalogue formations technique RENAULT TRUCKS 2026 v2.pdf',
    fileEn: 'RENAULT TRUCKS Technical training Catalogue 2026 v1.pdf',
  },
  'Hino': {
    folder: 'hino',
    file: 'Catalogue formations technique HINO 2026 v2.pdf',
    fileEn: 'HINO Technical training Catalogue 2026 v1.pdf',
  },
  'Fuso': {
    folder: 'fuso',
    file: 'Catalogue formations technique FUSO 2026 v2.pdf',
    fileEn: 'FUSO  Technical training Catalogue 2026 v1.pdf',
  },
  'Sinotruk': {
    folder: 'sinotruk',
    file: 'Catalogue formations technique SINOTRUK 2026 v2.pdf',
    fileEn: 'SINOTRUK HOHAN Technical Training Catalogue 2026 v1.pdf',
  },
  'Shacman': {
    folder: 'shacman',
    file: 'Catalogue formations technique SHACMAN 2026.pdf',
    fileEn: 'SHACMAN Technical training Catalogue 2026 v1.pdf',
  },
  'King Long': {
    folder: 'king long',
    file: 'Catalogue formations technique KING LONG 2026 v2.pdf',
    fileEn: 'KING LONG Technical training Catalogue 2026 v1.pdf',
  },
  'BT': {
    folder: 'bt',
    file: 'Catalogue formations technique TOYOTA BT 2026 v2.pdf',
    fileEn: 'TOYOTA BT Technical Training catalogue 2026 v1.pdf',
  },
  'Toyota Material': {
    folder: 'toyota forklift',
    file: 'Catalogue formation TOYOTA FORKLIFT 2026 v2.pdf',
    fileEn: 'TOYOTA FORKLIFT Technical training Catalogue 2026 v1.pdf',
  },
  'JCB': {
    folder: 'jcb',
    file: 'Catalogue formation technique JCB 2026 v2.pdf',
    fileEn: 'JCB Technical Training catalogue 2026 v1.pdf',
  },
  'Lovol': {
    folder: 'lovol',
    file: 'Catalogue Formation Technique LOVOL 2026.pdf',
    fileEn: 'LOVOL Technical Training catalogue 2026 v1.pdf',
  },
}

export function isBrandCatalogueComingSoon(brandName) {
  return COMING_SOON_BRANDS.has(brandName)
}

export function getBrandCataloguePdf(brandName, locale = 'fr') {
  if (isBrandCatalogueComingSoon(brandName)) return null
  const entry = BRAND_CATALOGUES[brandName]
  if (!entry) return null
  return cataloguePdfUrl(entry, locale)
}

export function hasBrandCataloguePdf(brandName) {
  return Boolean(BRAND_CATALOGUES[brandName]) && !isBrandCatalogueComingSoon(brandName)
}
