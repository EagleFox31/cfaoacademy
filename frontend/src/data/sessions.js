import raw from './sessions-2026.json'
import { canonicalTrainingCode } from '../utils/trainingCode.js'

const BU_MAP = {
  Motors: { id: 'Techniques Motors', tagClass: 'motors' },
  Equipment: { id: 'Techniques Equipment', tagClass: 'equipment' },
  Carrosserie: { id: 'Techniques Carrosserie', tagClass: 'carrosserie' },
  'Parts & Process Motors': { id: 'Parts & Process Motors', tagClass: 'parts-motors' },
  'Parts & Process Equipment': { id: 'Parts & Process Equipment', tagClass: 'parts-eq' },
}

function inferNiveau(code) {
  const c = (code ?? '').trim()
  if (!c || c === '—' || c === '-') return ''
  const m = c.match(/(G[1-4]|N[1-5]|BEV\d*|BEV|CERTIFIED|Step\s*\d+|FTIR\d*|TSA\d*)/i)
  return m ? m[1].replace(/\s+/g, ' ') : ''
}

function formatFormateur(name) {
  if (!name?.trim()) return ''
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Planning réel 2026 — source : data/sessions.json */
export const SESSIONS = raw.map((s, index) => {
  const cfg = BU_MAP[s.bu] ?? { id: s.bu, tagClass: 'motors' }
  return {
    uid: `${s.debut}|${s.code}|${index}`,
    date: s.debut,
    fin: s.fin,
    jours: s.jours,
    niveau: inferNiveau(s.code),
    formateur: formatFormateur(s.formateur),
    code: canonicalTrainingCode(s.code),
    nom: s.nom,
    marque: s.marque,
    lieu: s.lieu,
    bu: cfg.id,
    tagClass: cfg.tagClass,
    type: s.type,
  }
})
