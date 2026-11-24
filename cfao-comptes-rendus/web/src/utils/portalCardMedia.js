import { adresse } from '../lib/adresse'
/**
 * Marque d'une carte de session : logo, ou à défaut un libellé texte.
 * Même table et mêmes règles que le portail (`cardBrandBadge.js`), réduite
 * à ce qu'affichent les cartes du formateur.
 */
const LOGOS_MARQUES = [
  ['Toyota', adresse('/assets/logos/toyota.png')],
  ['Mercedes-Benz', adresse('/assets/logos/mercedes.png')],
  ['Suzuki', adresse('/assets/logos/suzuki.png')],
  ['BYD', adresse('/assets/logos/byd.png')],
  ['Mitsubishi', adresse('/assets/logos/mitsubishi.png')],
  ['Omoda & Jaecoo', adresse('/assets/logos/omoda.png')],
  ['Stellantis', adresse('/assets/logos/stellantis.png')],
  ['Citroën', adresse('/assets/logos/citroen.png')],
  ['Yamaha', adresse('/assets/logos/yamaha.png')],
  ['Renault Trucks', adresse('/assets/logos/renault-trucks.png')],
  ['Hino', adresse('/assets/logos/hino.png')],
  ['Fuso', adresse('/assets/logos/fuso.png')],
  ['Sinotruk', adresse('/assets/logos/sinotruk.png')],
  ['Shacman', adresse('/assets/logos/shacman.png')],
  ['Mercedes Trucks', adresse('/assets/logos/mercedes.png')],
  ['King Long', adresse('/assets/logos/kinglong.png')],
  ['BT', adresse('/assets/logos/bt.png')],
  ['Toyota Material', adresse('/assets/logos/toyota-forklift.png')],
  ['JCB', adresse('/assets/logos/jcb.png')],
  ['Lovol', adresse('/assets/logos/lovol.png')],
]

const LOGOS = Object.fromEntries(LOGOS_MARQUES.map(([nom, logo]) => [nom.toUpperCase(), logo]))

const ALIAS = {
  'MERCEDES-BENZ': 'MERCEDES-BENZ',
  MERCEDES: 'MERCEDES-BENZ',
  'OMODA & JAECCO': 'OMODA & JAECCO',
  'OMODA-JAECCO': 'OMODA & JAECCO',
  'OMODA-JAECOO': 'OMODA & JAECCO',
  'TOYOTA FORKLIFT': 'TOYOTA MATERIAL',
  'TOYOTA-FORKLIFT': 'TOYOTA MATERIAL',
  'TOYOTA MATERIAL': 'TOYOTA MATERIAL',
  'RENAULT TRUCKS': 'RENAULT TRUCKS',
  'RENAULT-TRUCKS': 'RENAULT TRUCKS',
  'KING LONG': 'KING LONG',
  'KING-LONG': 'KING LONG',
  'MERCEDES TRUCKS': 'MERCEDES TRUCKS',
}

const LIBELLES = {
  'TOUTES MARQUES': 'Toutes marques',
  'TOUTES MARQUES VL': 'Toutes marques',
  CARROSSERIE: 'Carrosserie',
  'PROCESS SAV': 'Process SAV',
  'PROCESS SAV & PARTS': 'Process SAV',
  'PARTS & PROCESS': 'Parts & Process',
  'PARTS & PROCESS MOTORS': 'SAV Motors',
  'PARTS & PROCESS EQUIPMENT': 'SAV Equipment',
  'RENAULT-TRUCKS': 'Renault Trucks',
  'KING-LONG': 'King Long',
  'TOYOTA-FORKLIFT': 'Toyota Material',
  'OMODA-JAECCO': 'Omoda & Jaecoo',
  'OMODA-JAECOO': 'Omoda & Jaecoo',
}

function norm(s) {
  return (s ?? '').trim().toUpperCase()
}

function chercherLogo(brut) {
  const cle = norm(brut)
  const espace = cle.replace(/-/g, ' ')
  const alias = ALIAS[cle] ?? ALIAS[espace] ?? cle
  return LOGOS[alias] ?? LOGOS[espace] ?? LOGOS[alias.split(' ')[0]] ?? null
}

function libelle(brut) {
  const cle = norm(brut)
  if (LIBELLES[cle]) return LIBELLES[cle]
  if (cle.startsWith('TOUTES MARQUES')) return 'Toutes marques'
  if (cle.includes('CARROSSERIE')) return 'Carrosserie'
  if (/PROCESS/.test(cle) && /SAV|PARTS/.test(cle)) return 'Process SAV'

  return brut
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Logo marque pour le corps de carte (comme SessionCard). */
export function resolvePortalCardBrand(brand) {
  const brut = brand?.trim()
  if (!brut) return {}
  const logo = chercherLogo(brut)
  return logo ? { logo } : { label: libelle(brut) }
}
