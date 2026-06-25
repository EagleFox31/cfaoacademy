/** BU → libellé filiale CFAO (ex. CFAO EQUIPMENT Cameroun). */
const BU_FILIALE_PREFIX = {
  motors: 'CFAO MOTORS',
  equipment: 'CFAO EQUIPMENT',
  carrosserie: 'CFAO MOBILITY',
  'parts-motors': 'CFAO MOBILITY',
  'parts-eq': 'CFAO MOBILITY',
}

/** Pays affiché / drapeau — explicite ou déduit du nom de filiale. */
export function resolveProfilePays(user) {
  if (user?.pays) return user.pays
  const filiale = user?.filiale ?? ''
  if (/^CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY)\s+/i.test(filiale)) {
    return filiale.replace(/^CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY)\s+/i, '').trim()
  }
  if (filiale === 'Groupe') return null
  return filiale || null
}

/** Libellé filiale CFAO (CFAO MOTORS Cameroun…). */
export function resolveProfileFilialeLabel(user) {
  if (user?.filiale?.startsWith('CFAO ')) return user.filiale
  const pays = resolveProfilePays(user)
  if (!pays || pays === 'Groupe') return user?.filiale ?? null
  const dept = user?.departments?.[0]
  const prefix = BU_FILIALE_PREFIX[dept]
  if (prefix) return `${prefix} ${pays}`
  return user?.filiale ?? pays
}

/**
 * Agence (site) — ex. Douala. Une filiale regroupe une ou plusieurs agences.
 */
export function resolveProfileAgencyLabel(user) {
  const orgLabel = user?.orgLabel?.trim()
  const filialeLabel = resolveProfileFilialeLabel(user)
  if (!orgLabel) return null
  if (filialeLabel && (orgLabel === filialeLabel || orgLabel === resolveProfilePays(user))) {
    return null
  }
  return orgLabel
}
