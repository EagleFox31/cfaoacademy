/** Codes planning / export Excel → code catalogue (fiche PNG / PDF). */

const CODE_ALIASES = {
  'O&amp;JEV02': 'OJEV02',
  'O&JEV02': 'OJEV02',
  'O&amp;JEV01': 'OJEV01',
  'O&JEV01': 'OJEV01',
  'O&amp;JEV03': 'OJEV03',
  'O&JEV03': 'OJEV03',
  PDI01: 'PDI09',
}

const SUZUKI_CERT_SUFFIX = /^(.+)-(BRONZE|SILVER|GOLD)$/i
const FUSO_CAN_SUFFIX = /^(.+)-CAN$/i

function normalizeHyphens(code) {
  return code.replace(/\s*-\s*/g, '-')
}

function processSavF0ToFo(code) {
  const m = code.match(/^F0(\d{2})$/i)
  return m ? `FO${m[1]}` : code
}

export function canonicalTrainingCode(code) {
  const raw = (code ?? '').trim()
  if (!raw) return ''
  const decoded = raw.replace(/&amp;/gi, '&')
  const upper = decoded.toUpperCase()
  const aliased = CODE_ALIASES[raw] ?? CODE_ALIASES[decoded] ?? CODE_ALIASES[upper] ?? decoded
  return processSavF0ToFo(normalizeHyphens(aliased))
}

/** Code fichier dans catalogues/ (suffixes planning retirés). */
export function ficheFileCode(code) {
  let c = canonicalTrainingCode(code)
  const suzuki = c.match(SUZUKI_CERT_SUFFIX)
  if (suzuki) c = suzuki[1]
  const can = c.match(FUSO_CAN_SUFFIX)
  if (can) c = can[1]
  return c
}
