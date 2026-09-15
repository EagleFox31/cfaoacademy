/**
 * Chemins fiches PNG / PDF sous `/catalogues/`.
 *
 * Aligné sur la vitrine (`formationFiche.js` / `BRAND_FOLDER`) sans charger
 * tout le training-catalog : Needs connaît déjà `brand_code` et `family_key`.
 */
import { ficheFileCode } from './trainingCode'

/** code marque Needs (slug) → dossier sous catalogues/ */
const BRAND_FOLDER_BY_CODE = {
  toyota: 'toyota',
  suzuki: 'suzuki',
  byd: 'byd',
  mercedes: 'mercedes',
  mitsubishi: 'mitsubishi',
  'omoda-jaecoo': 'omoda-jaecco',
  stellantis: 'stellantis',
  peugeot: 'stellantis',
  citroen: 'stellantis',
  fiat: 'stellantis',
  jeep: 'stellantis',
  jcb: 'jcb',
  lovol: 'lovol',
  'toyota-forklift': 'toyota forklift',
  fuso: 'fuso',
  hino: 'hino',
  'king-long': 'king long',
  'renault-trucks': 'renault trucks',
  shacman: 'shacman',
  sinotruk: 'sinotruk',
  bt: 'bt',
  yamaha: 'yamaha',
  'mercedes-trucks': 'mercedes trucks',
}

const PROCESS_FOLDER_BY_FAMILY = {
  'process-sav-motors': 'process_sav_parts_motors/process_sav',
  'process-parts-motors': 'process_sav_parts_motors/process_parts',
  'process-sav-equipment': 'process_sav_parts_equipment/process_sav',
  'process-parts-equipment': 'process_sav_parts_equipment/process_parts',
  'techniques-carrosserie': 'carrosserie',
}

function encodeCatalogPath(folder, fileName) {
  const encodedFolder = String(folder)
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return `/catalogues/${encodedFolder}/${encodeURIComponent(fileName)}`
}

/**
 * Dossier catalogue pour une ligne Needs.
 * @param {{ brand_code?: string, family_key?: string }} line
 */
export function catalogueFolderForLine(line) {
  const family = String(line?.family_key || '').toLowerCase()
  if (PROCESS_FOLDER_BY_FAMILY[family]) return PROCESS_FOLDER_BY_FAMILY[family]

  const brand = String(line?.brand_code || '').toLowerCase()
  if (BRAND_FOLDER_BY_CODE[brand]) return BRAND_FOLDER_BY_CODE[brand]

  // Transverse / inconnu : pas de dossier fiable.
  return null
}

/**
 * URLs candidates PNG + PDF pour une thématique.
 * @returns {{ folder: string|null, fileCode: string, pngUrl: string|null, pdfUrl: string|null }}
 */
export function ficheUrlsForLine(line) {
  const fileCode = ficheFileCode(line?.code)
  const folder = catalogueFolderForLine(line)
  if (!folder || !fileCode) {
    return { folder, fileCode, pngUrl: null, pdfUrl: null }
  }
  return {
    folder,
    fileCode,
    pngUrl: encodeCatalogPath(folder, `${fileCode}.png`),
    pdfUrl: encodeCatalogPath(folder, `${fileCode}.pdf`),
  }
}

/** URL de la page viewer (nouvelle fenêtre). */
export function ficheViewerPath(line, { title } = {}) {
  const code = encodeURIComponent(String(line?.code || '').trim())
  const params = new URLSearchParams()
  if (line?.brand_code) params.set('brand', line.brand_code)
  if (line?.family_key) params.set('family', line.family_key)
  if (title) params.set('title', title)
  const qs = params.toString()
  return `/fiche/${code}${qs ? `?${qs}` : ''}`
}

export function openFicheWindow(line, { title } = {}) {
  const path = ficheViewerPath(line, { title })
  // Nom unique par code : réouvrir la même thématique focus la fenêtre existante ;
  // width/height force une vraie fenêtre (sinon Chrome ouvre un onglet).
  const name = `needs-fiche-${String(line?.code || 'x').replace(/[^\w.-]+/g, '_')}`
  const features = [
    'popup=yes',
    'width=920',
    'height=1000',
    'left=80',
    'top=40',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',')
  const win = window.open(path, name, features)
  if (win) {
    win.opener = null
    win.focus()
  }
}
