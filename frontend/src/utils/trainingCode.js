/** Codes planning / export Excel → code catalogue (fiche PNG). */
const CODE_ALIASES = {
  'O&amp;JEV02': 'OJEV02',
  'O&JEV02': 'OJEV02',
  'O&amp;JEV01': 'OJEV01',
  'O&JEV01': 'OJEV01',
  'O&amp;JEV03': 'OJEV03',
  'O&JEV03': 'OJEV03',
  /** Excel process SAV : PDI01 → fiche catalogue PDI09 */
  PDI01: 'PDI09',
}

/** Planning Suzuki : SS05-SILVER → fiche catalogue SS05.png */
const SUZUKI_CERT_SUFFIX = /^(.+)-(BRONZE|SILVER|GOLD)$/i

/** Planning FUSO CANTER : F04-CAN → F04.png */
const FUSO_CAN_SUFFIX = /^(.+)-CAN$/i

/** Excel : « TS04 - G3 » → TS04-G3 */
function normalizeHyphens(code) {
  return code.replace(/\s*-\s*/g, '-')
}

/** Excel process SAV : F003 (zéro) → FO03 (lettre O), idem F001…F006 */
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

/** Code fichier PNG dans catalogues/ (suffixes planning retirés). */
export function ficheFileCode(code) {
  let c = canonicalTrainingCode(code)
  const suzuki = c.match(SUZUKI_CERT_SUFFIX)
  if (suzuki) c = suzuki[1]
  const can = c.match(FUSO_CAN_SUFFIX)
  if (can) c = can[1]
  return c
}
