/** BU → libellé filiale CFAO (ex. CFAO EQUIPMENT Cameroun). */
const BU_FILIALE_PREFIX = {
  motors: 'CFAO MOTORS',
  equipment: 'CFAO EQUIPMENT',
  carrosserie: 'CFAO MOBILITY',
  'parts-motors': 'CFAO MOBILITY',
  'parts-eq': 'CFAO MOBILITY',
}

const BU_SHORT_LABEL = {
  fr: {
    motors: 'motors',
    equipment: 'equipment',
    carrosserie: 'carrosserie',
    'parts-motors': 'pièces',
    'parts-eq': 'pièces',
  },
  en: {
    motors: 'Motors',
    equipment: 'Equipment',
    carrosserie: 'body shop',
    'parts-motors': 'parts',
    'parts-eq': 'parts',
  },
  pt: {
    motors: 'Motors',
    equipment: 'Equipment',
    carrosserie: 'carroçaria',
    'parts-motors': 'peças',
    'parts-eq': 'peças',
  },
}

/** BU courte pour la salutation hero DPS (ex. « equipment »). */
export function resolveProfileBuShortLabel(user, locale = 'fr') {
  const dept = user?.departments?.[0]
  const labels = BU_SHORT_LABEL[locale] ?? BU_SHORT_LABEL.fr
  return labels[dept] ?? dept ?? (locale === 'fr' ? 'filiale' : 'branch')
}

export function normalizeFilialeName(name) {
  if (!name) return name
  const trimmed = name.trim()
  if (/^CAMEROON\s+MOTORS(?:\s+INDUSTRIES)?$/i.test(trimmed)) {
    return 'CFAO MOBILITY CAMEROUN'
  }
  return trimmed
}

/** Pays affiché / drapeau — explicite ou déduit du nom de filiale. */
export function resolveProfilePays(user) {
  if (user?.pays) return user.pays
  const filiale = normalizeFilialeName(user?.filiale ?? '')
  if (/^CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY)\s+/i.test(filiale)) {
    return filiale.replace(/^CFAO\s+(?:MOTORS|EQUIPMENT|MOBILITY)\s+/i, '').trim()
  }
  if (filiale === 'Groupe') return null
  return filiale || null
}

/** Libellé filiale CFAO (CFAO MOBILITY CAMEROUN…). */
export function resolveProfileFilialeLabel(user) {
  const filiale = normalizeFilialeName(user?.filiale)
  if (filiale?.startsWith('CFAO ')) return filiale
  const pays = resolveProfilePays(user)
  if (!pays || pays === 'Groupe') return filiale ?? null
  const dept = user?.departments?.[0]
  const prefix = BU_FILIALE_PREFIX[dept]
  if (prefix) return `${prefix} ${pays}`
  return filiale ?? pays
}

/**
 * Agence (site) — ex. Douala. Une filiale regroupe une ou plusieurs agences.
 * Norme affichage : libellé géo (agence, filiale, pays) toujours accompagné du drapeau pays.
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
