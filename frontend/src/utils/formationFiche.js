import CATALOG from '../data/training-catalog.json'
import { SESSIONS } from '../data/index.js'
import { canonicalTrainingCode, ficheFileCode } from './trainingCode.js'
import { appendSessionsReturnParams } from './sessionsReturn.js'

export { canonicalTrainingCode, ficheFileCode } from './trainingCode.js'

export const BRAND_FOLDER = {
  TOYOTA: 'toyota',
  SUZUKI: 'suzuki',
  BYD: 'byd',
  MERCEDES: 'mercedes',
  MITSUBISHI: 'mitsubishi',
  'OMODA & JAECCO': 'omoda-jaecco',
  STELLANTIS: 'stellantis',
  JCB: 'jcb',
  LOVOL: 'lovol',
  'TOYOTA FORKLIFT': 'toyota forklift',
  FUSO: 'fuso',
  HINO: 'hino',
  'KING LONG': 'king long',
  'RENAULT TRUCKS': 'renault trucks',
  SHACMAN: 'shacman',
  SINOTRUK: 'sinotruk',
  BT: 'bt',
  YAMAHA: 'yamaha',
  'MERCEDES TRUCKS': 'mercedes trucks',
}

const PROCESS_FOLDERS = {
  PROCESS_SAV_PARTS_MOTORS: {
    PROCESS_SAV: 'process_sav_parts_motors/process_sav',
    PROCESS_PARTS: 'process_sav_parts_motors/process_parts',
  },
  PROCESS_SAV_PARTS_EQUIPMENT: {
    PROCESS_SAV: 'process_sav_parts_equipment/process_sav',
    PROCESS_PARTS: 'process_sav_parts_equipment/process_parts',
  },
}

const MARQUE_TO_BRAND = {
  'MERCEDES-BENZ': 'MERCEDES',
}

function norm(s) {
  return (s ?? '').trim().toUpperCase()
}

export function fichePath(folder, code) {
  const fileCode = ficheFileCode(code)
  const encodedFolder = folder.split('/').map(encodeURIComponent).join('/')
  return `/catalogues/${encodedFolder}/${encodeURIComponent(fileCode)}.png`
}

function registerCatalogEntry(folderMap, trainingMap, folder, training, opts = {}) {
  const code = canonicalTrainingCode(training?.code)
  if (!code) return
  if (!folderMap[code]) folderMap[code] = folder
  if (!trainingMap[code]) {
    trainingMap[code] = {
      name: training.name?.trim() || null,
      public: training.public?.trim() || null,
      type: training.type?.trim() || null,
      duration: training.duration?.trim() || null,
      catalogLevel: opts.catalogLevel ?? null,
      catalogBrand: opts.catalogBrand ?? null,
      marques: Array.isArray(training.marques) ? training.marques : null,
      isProcess: Boolean(opts.isProcess),
      folder,
    }
  }
}

function indexProcessSections(folderMap, trainingMap) {
  for (const [rootKey, sections] of Object.entries(PROCESS_FOLDERS)) {
    const block = CATALOG[rootKey]
    if (!block || typeof block !== 'object') continue
    for (const [sectionKey, folder] of Object.entries(sections)) {
      const brands = block[sectionKey]
      if (!brands || typeof brands !== 'object') continue
      for (const [brandKey, trainings] of Object.entries(brands)) {
        if (!Array.isArray(trainings)) continue
        for (const t of trainings) {
          registerCatalogEntry(folderMap, trainingMap, folder, t, {
            isProcess: true,
            catalogBrand: brandKey,
          })
        }
      }
    }
  }
}

function indexBrandCatalogs(folderMap, trainingMap) {
  for (const [brandKey, groups] of Object.entries(CATALOG)) {
    if (!Array.isArray(groups)) continue
    const folder = BRAND_FOLDER[brandKey]
    if (!folder) continue
    for (const group of groups) {
      for (const t of group.trainings ?? []) {
        registerCatalogEntry(folderMap, trainingMap, folder, t, {
          catalogLevel: group.level ?? null,
        })
      }
    }
  }
}

function indexCarrosserie(folderMap, trainingMap) {
  const groups = CATALOG.CARROSSERIE
  if (!Array.isArray(groups)) return
  for (const group of groups) {
    for (const t of group.trainings ?? []) {
      registerCatalogEntry(folderMap, trainingMap, 'carrosserie', t, {
        catalogLevel: group.level ?? null,
      })
    }
  }
}

const { CODE_TO_FOLDER, CODE_TO_TRAINING } = (() => {
  const folderMap = {}
  const trainingMap = {}
  indexProcessSections(folderMap, trainingMap)
  indexBrandCatalogs(folderMap, trainingMap)
  indexCarrosserie(folderMap, trainingMap)
  return { CODE_TO_FOLDER: folderMap, CODE_TO_TRAINING: trainingMap }
})()

function isProcessSession(session, meta) {
  if (meta?.isProcess) return true
  const tc = session?.tagClass
  return tc === 'parts-motors' || tc === 'parts-eq'
}

function isCarrosserieSession(session) {
  return (
    session?.tagClass === 'carrosserie'
    || session?.bu?.includes('Carrosserie')
    || norm(session?.marque) === 'CARROSSERIE'
  )
}

/** Libellé métier affiché (ex. carrosserie → Carrossier, pas « Préparateur VL »). */
function formatPublicCible(session, raw) {
  if (!raw) return null
  const key = norm(raw).normalize('NFD').replace(/\p{M}/gu, '')
  if (isCarrosserieSession(session) && key.startsWith('PREPARATEUR')) {
    return 'Carrossier'
  }
  return raw
}

/** Titre officiel catalogue (aligné sur la fiche PNG), sinon libellé session. */
export function getFormationFicheTitle(session) {
  const code = canonicalTrainingCode(session?.code)
  const fileCode = ficheFileCode(session?.code)
  const meta = code ? (CODE_TO_TRAINING[code] ?? CODE_TO_TRAINING[fileCode]) : null
  return meta?.name ?? session?.nom?.trim() ?? ''
}

/** Métadonnées catalogue pour l'en-tête de la fiche (public, niveau). */
export function getFormationFicheDescriptor(session) {
  const code = canonicalTrainingCode(session?.code)
  const fileCode = ficheFileCode(session?.code)
  const meta = code ? (CODE_TO_TRAINING[code] ?? CODE_TO_TRAINING[fileCode]) : null
  const isProcess = isProcessSession(session, meta)

  const publicCible = formatPublicCible(session, meta?.public ?? null)

  if (isProcess) {
    return { kind: 'process', publicCible }
  }

  const niveau = session.niveau?.trim() || meta?.catalogLevel || null
  return {
    kind: 'technical',
    niveau,
    publicCible,
  }
}

function inferFolder(session) {
  const { tagClass, marque } = session
  if (tagClass === 'carrosserie') return 'carrosserie'
  if (tagClass === 'parts-motors') {
    const m = norm(marque)
    if (m.includes('TOUTES')) return 'process_sav_parts_motors/process_parts'
    return 'process_sav_parts_motors/process_sav'
  }
  if (tagClass === 'parts-eq') {
    return 'process_sav_parts_equipment/process_parts'
  }
  const brandKey = MARQUE_TO_BRAND[norm(marque)] ?? marque
  return BRAND_FOLDER[brandKey] ?? BRAND_FOLDER[norm(marque)] ?? null
}

export function resolveFormationFicheUrl(session) {
  const code = canonicalTrainingCode(session?.code)
  if (!code) return null
  const fileCode = ficheFileCode(session?.code)
  const folder = CODE_TO_FOLDER[code] ?? CODE_TO_FOLDER[fileCode] ?? inferFolder(session)
  if (!folder) return null
  return fichePath(folder, code)
}

export function formationFicheRoute(sessionOrCode, returnCtx) {
  const raw = typeof sessionOrCode === 'object' ? sessionOrCode.code : sessionOrCode
  const code = canonicalTrainingCode(raw)
  const sessionDate = typeof sessionOrCode === 'object' ? sessionOrCode.date : undefined
  const base = `/formations/fiche/${encodeURIComponent(code)}`
  const params = new URLSearchParams()
  if (sessionDate) params.set('date', sessionDate)
  appendSessionsReturnParams(params, returnCtx)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function getSessionByCode(codeParam, dateParam) {
  const code = canonicalTrainingCode(decodeURIComponent(codeParam ?? ''))
  const date = dateParam ? decodeURIComponent(dateParam) : null
  if (date) {
    return SESSIONS.find((s) => canonicalTrainingCode(s.code) === code && s.date === date) ?? null
  }
  return SESSIONS.find((s) => canonicalTrainingCode(s.code) === code) ?? null
}

/** Fiche catalogue sans session planifiée (process SAV, carrosserie, etc.). */
export function getCatalogFicheByCode(codeParam) {
  const code = canonicalTrainingCode(decodeURIComponent(codeParam ?? ''))
  if (!code) return null
  const fileCode = ficheFileCode(code)
  const meta = CODE_TO_TRAINING[code] ?? CODE_TO_TRAINING[fileCode]
  const folder = meta?.folder ?? CODE_TO_FOLDER[code] ?? CODE_TO_FOLDER[fileCode]
  if (!folder || !meta?.name) return null
  return {
    code,
    folder,
    url: fichePath(folder, code),
    name: meta.name,
    public: meta.public,
    type: meta.type,
    duration: meta.duration,
    isProcess: meta.isProcess,
    catalogLevel: meta.catalogLevel,
    catalogBrand: meta.catalogBrand,
    marques: meta.marques,
  }
}

export function catalogFicheLogoContext(catalog) {
  const folder = catalog?.folder ?? ''
  if (folder === 'carrosserie') {
    return { marque: 'CARROSSERIE', bu: 'Techniques Carrosserie', tagClass: 'carrosserie' }
  }
  if (folder.includes('equipment')) {
    return { marque: 'TOUTES MARQUES EQUIPMENT', bu: 'Parts & Process Equipment', tagClass: 'parts-eq' }
  }
  if (folder.includes('motors')) {
    return { marque: 'TOUTES MARQUES VL', bu: 'Parts & Process Motors', tagClass: 'parts-motors' }
  }
  return { marque: null, bu: null, tagClass: 'motors' }
}

export function getCatalogFicheDescriptor(catalog) {
  if (!catalog) return { kind: 'technical', niveau: null, publicCible: null }
  if (catalog.isProcess) {
    return { kind: 'process', publicCible: catalog.public ?? null }
  }
  return {
    kind: 'technical',
    niveau: catalog.catalogLevel ?? null,
    publicCible: catalog.public ?? null,
  }
}
