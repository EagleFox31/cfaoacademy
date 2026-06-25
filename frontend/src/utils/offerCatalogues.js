import { cataloguePdfUrl } from './cataloguePdf.js'

/** Catalogues PDF par offre (accueil — hors marques Motors/Equipment). */
export const OFFER_CATALOGUES = {
  carrosserie: {
    folder: 'carrosserie',
    file: 'Offre de Formation Technique Carrosserie 2026.pdf',
    fileEn: 'Bodywork_Training_Catalogue_2026.pdf',
    kicker: 'Catalogue PDF · 2026',
    title: 'Offre de formation technique Carrosserie',
    meta: 'N1 → N5 · Présentiel',
    img: '/assets/publics/carrossiers.jpg',
  },
  savMotors: {
    folder: 'process_sav_parts_motors',
    file: 'Offre de Formation Process SAV  PART MOBILITY 2026.pdf',
    fileEn: 'CFAO_Mobility_2026_Training_Catalog.pdf',
    kicker: 'Catalogue PDF · Motors',
    title: 'Organisation SAV Motors',
    meta: 'SAV · Pièces · Front & back office',
    img: '/assets/publics/process-sav.jpg',
  },
  savEquipment: {
    folder: 'process_sav_parts_equipment',
    file: 'Offre de Formation Process SAV_PART EQUIPMENT 2026.pdf',
    fileEn: 'Process_SAV_PART_EQUIPMENT_Training_Catalogue_2026.pdf',
    kicker: 'Catalogue PDF · Equipment',
    title: 'Organisation SAV Equipment',
    meta: 'SAV · Pièces · Toutes marques',
    img: '/assets/publics/process-sav.jpg',
  },
}

export function getOfferCataloguePdf(offerId, locale = 'fr') {
  const entry = OFFER_CATALOGUES[offerId]
  if (!entry) return null
  return cataloguePdfUrl(entry, locale)
}
