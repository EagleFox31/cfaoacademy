import equipePoles from '../data/academy/equipe-poles.json'
import { TEAM } from '../data/index.js'

const NO_PHOTO = new Set(['PIC', 'KI', 'PIC MULTI'])

/** Silhouette formateur inconnu / PIC — remplaçable par unknown.png si ajouté. */
export const FORMATEUR_UNKNOWN_PHOTO = '/assets/team/unknown.svg'

function normalizeName(value) {
  if (!value?.trim()) return ''
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
}

function buildRoster() {
  const byKey = new Map()

  const add = ({ name, photo, silhouette }) => {
    if (!name?.trim() || silhouette || !photo) return
    const key = normalizeName(name)
    if (!key || byKey.has(key)) return
    byKey.set(key, { photo, name: name.trim() })
  }

  for (const pole of equipePoles.poles) {
    for (const member of pole.members) add(member)
  }
  for (const member of TEAM) add(member)

  return byKey
}

const ROSTER_BY_KEY = buildRoster()

/** Correspondances planning → fiche équipe (nom tronqué ou variante). */
const ALIASES = {
  'THIERRY TAMO': 'THIERRY TAMO YOUDOM',
}

function findByPrefix(key) {
  if (ROSTER_BY_KEY.has(key)) return ROSTER_BY_KEY.get(key)

  const alias = ALIASES[key]
  if (alias && ROSTER_BY_KEY.has(alias)) return ROSTER_BY_KEY.get(alias)

  for (const [rosterKey, entry] of ROSTER_BY_KEY) {
    if (rosterKey.startsWith(`${key} `) || rosterKey.startsWith(key)) {
      return entry
    }
  }

  const tokens = key.split(' ').filter(Boolean)
  if (tokens.length >= 2) {
    let best = null
    let bestLen = Infinity
    for (const [rosterKey, entry] of ROSTER_BY_KEY) {
      if (tokens.every((t) => rosterKey.includes(t)) && rosterKey.length < bestLen) {
        best = entry
        bestLen = rosterKey.length
      }
    }
    if (best) return best
  }

  return null
}

/**
 * Retourne { photo, name } ou null si pas de fiche équipe (PIC garde le nom, pas de photo dédiée).
 * @param {string} formateurName — nom issu du planning (déjà formaté ou brut)
 */
export function resolveFormateurPhoto(formateurName) {
  const key = normalizeName(formateurName)
  if (!key || NO_PHOTO.has(key)) return null
  return findByPrefix(key)
}

/** URL avatar : photo équipe ou image « unknown ». */
export function getFormateurAvatarUrl(formateurName) {
  if (!formateurName?.trim()) return null
  return resolveFormateurPhoto(formateurName)?.photo ?? FORMATEUR_UNKNOWN_PHOTO
}

export function isFormateurUnknownAvatar(formateurName) {
  return !resolveFormateurPhoto(formateurName)?.photo
}
