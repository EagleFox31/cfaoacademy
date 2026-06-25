import { PUBLICS } from '../data/index.js'
import { HERO_PERSONA_IDS } from '../i18n/hero.js'

/** Clé `name` dans PUBLICS → id persona hero (accueil) */
const PUBLIC_NAME_TO_PERSONA = {
  'Techniciens Voitures': 'vl',
  'Techniciens Poids lourds, Engins, Chariots & Bus': 'pl',
  Carrossiers: 'carrossier',
  Parts: 'savParts',
  'Technico-commerciaux': 'savParts',
  Commerciaux: 'savParts',
  'Process SAV & Parts': 'savParts',
}

/** Département profil → persona hero */
const DEPARTMENT_TO_PERSONA = {
  motors: 'vl',
  equipment: 'pl',
  carrosserie: 'carrossier',
  'parts-motors': 'savParts',
  'parts-eq': 'savParts',
}

export function resolveUserPersonaId(user) {
  if (user?.persona && HERO_PERSONA_IDS.includes(user.persona)) {
    return user.persona
  }
  if (user?.public && PUBLIC_NAME_TO_PERSONA[user.public]) {
    return PUBLIC_NAME_TO_PERSONA[user.public]
  }
  for (const dept of user?.departments ?? []) {
    if (DEPARTMENT_TO_PERSONA[dept]) return DEPARTMENT_TO_PERSONA[dept]
  }
  return null
}

/** Libellé court affiché après « Apprenant : » */
export function resolveLearnerPersonaLabel(user, heroT, publicsT) {
  const personaId = resolveUserPersonaId(user)
  if (personaId && heroT?.personas?.[personaId]?.label) {
    return heroT.personas[personaId].label
  }

  if (user?.public) {
    const localized = publicsT?.[user.public]?.name
    if (localized) return localized
    const pub = PUBLICS.find(p => p.name === user.public)
    if (pub?.kicker) {
      const short = pub.kicker.split('·').pop()?.trim()
      if (short) return short
    }
    return user.public
  }

  return null
}

export function formatLearnerRoleBadge(roleLabel, user, heroT, publicsT) {
  const personaLabel = resolveLearnerPersonaLabel(user, heroT, publicsT)
  if (!personaLabel) return roleLabel
  return `${roleLabel} : ${personaLabel}`
}
