/**
 * Icônes de profil portail — poste (KI, chefs, DPS/DOP) + niveau Toyota Gx.
 * Fichiers : frontend/public/assets/{technicieng1…3,technicienG4,KI,chef-*,dps-*,dop-*}.png
 *
 * DPS/DOP : peaux `blanc` | `noir`. Défaut `blanc` (Cameroun actuel) ;
 * override via `avatarSkin: 'noir'` sur le profil si besoin.
 */
import { getPrimaryRole } from '../data/index.js'

export const PROFILE_ICON = {
  G1: '/assets/technicieng1.png',
  G2: '/assets/technicieng2.png',
  G3: '/assets/technicieng3.png',
  G4: '/assets/technicienG4.png',
  ki: '/assets/KI.png',
  team_manager: '/assets/chef-equipe.png',
  workshop_manager: '/assets/chef-atelier.png',
  dps: {
    blanc: '/assets/dps-blanc.png',
    noir: '/assets/dps-noir.png',
  },
  dop: {
    blanc: '/assets/dop-blanc.png',
    noir: '/assets/dop-noir.png',
  },
  fallbackTech: '/assets/icone_technicien.png',
}

const TOYOTA_GX = new Set(['G1', 'G2', 'G3', 'G4'])
const POSTE_ROLES = new Set(['ki', 'team_manager', 'workshop_manager', 'dps', 'dop'])

export function normalizeToyotaGxIconLevel(raw) {
  const token = String(raw ?? '').trim().toUpperCase()
  if (TOYOTA_GX.has(token)) return token
  const match = token.match(/\b(G[1-4])\b/)
  if (match && TOYOTA_GX.has(match[1])) return match[1]
  return null
}

/** Peau DPS/DOP — Cameroun = blanc par défaut. */
export function resolveDirectorAvatarSkin(person = {}) {
  const raw = person.avatarSkin ?? person.profileIconSkin ?? person.directorSkin
  return String(raw ?? '').toLowerCase() === 'noir' ? 'noir' : 'blanc'
}

export function resolveToyotaGxProfileIcon(level) {
  const gx = normalizeToyotaGxIconLevel(level)
  return gx ? PROFILE_ICON[gx] : null
}

function brandIdsOf(person) {
  const ids = []
  if (person?.brand) ids.push(person.brand)
  if (Array.isArray(person?.brands)) ids.push(...person.brands)
  return ids.map(id => String(id ?? '').toLowerCase().trim()).filter(Boolean)
}

function hasToyotaBrand(person) {
  return brandIdsOf(person).includes('toyota')
}

/** Palier MEDACAP → Gx Toyota (G1 non distingué côté 3 paliers → G2). */
const TIER_TO_TOYOTA_GX = {
  junior: 'G4',
  senior: 'G3',
  expert: 'G2',
}

/** Niveau Gx à afficher — suit certLevels / TEAM-GP / certLevel carte. */
export function resolvePersonToyotaGxLevel(person = {}) {
  if (person.toyotaLevel != null) return normalizeToyotaGxIconLevel(person.toyotaLevel)
  if (person.teamgpLevel != null) return normalizeToyotaGxIconLevel(person.teamgpLevel)
  if (person.teamgp?.level != null) return normalizeToyotaGxIconLevel(person.teamgp.level)

  const fromCertMap = normalizeToyotaGxIconLevel(person.certLevels?.toyota)
  if (fromCertMap) return fromCertMap

  if (person.certLevel != null && hasToyotaBrand(person)) {
    return normalizeToyotaGxIconLevel(person.certLevel)
  }

  if (hasToyotaBrand(person) && person.primaryTier) {
    const mapped = TIER_TO_TOYOTA_GX[String(person.primaryTier).toLowerCase()]
    if (mapped) return mapped
  }
  return null
}

function resolvePosteIcon(primaryRole, person) {
  if (primaryRole === 'dps' || primaryRole === 'dop') {
    return PROFILE_ICON[primaryRole][resolveDirectorAvatarSkin(person)]
  }
  if (primaryRole === 'ki' || primaryRole === 'team_manager' || primaryRole === 'workshop_manager') {
    return PROFILE_ICON[primaryRole]
  }
  return null
}

/**
 * URL d’icône profil, ou null (garder initiales).
 * Priorité : override → poste (KI / chefs / DPS / DOP) → Toyota Gx si applicable.
 *
 * @param {object|null|undefined} person profil auth, membre équipe ou ligne technicien
 * @param {{ fallbackTech?: boolean }} [options] fallbackTech → icone_technicien générique
 */
export function resolveProfileIcon(person, options = {}) {
  const { fallbackTech = false } = options
  if (!person) return fallbackTech ? PROFILE_ICON.fallbackTech : null

  const override = person.profileIcon || person.avatarUrl
  if (override) return override

  const primary = getPrimaryRole(person.roles ?? [])
  if (POSTE_ROLES.has(primary)) {
    return resolvePosteIcon(primary, person)
  }

  const gx = resolvePersonToyotaGxLevel(person)
  if (gx) {
    const toyotaContext =
      hasToyotaBrand(person)
      || person.certLevels?.toyota != null
      || person.teamgp?.level != null
      || person.toyotaLevel != null
      || person.teamgpLevel != null
    if (toyotaContext) return PROFILE_ICON[gx]
  }

  return fallbackTech ? PROFILE_ICON.fallbackTech : null
}
