import { PUBLICS } from '../data/index.js'
import { HERO_PERSONA_IDS } from '../i18n/hero.js'

/** Clé `name` dans PUBLICS → id persona hero (accueil) */
const LEGACY_PUBLIC_NAMES = {
  Parts: 'Manager et conseillers services administratifs, financiers',
  'Process Parts': 'Manager et conseillers services administratifs, financiers',
  'Process SAV': 'Manager et responsables organisation SAV',
  'Process SAV & Parts': 'Manager et responsables organisation SAV',
}

const PUBLIC_NAME_TO_PERSONA = {
  'Techniciens Voitures': 'vl',
  'Techniciens Poids lourds, Engins, Chariots & Bus': 'pl',
  Carrossiers: 'carrossier',
  'Manager et conseillers services administratifs, financiers': 'savParts',
  'Manager et responsables organisation SAV': 'savParts',
  'Process Parts': 'savParts',
  Parts: 'savParts',
  'Technico-commerciaux': 'savParts',
  Commerciaux: 'savParts',
  'Process SAV': 'savParts',
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
    const publicKey = LEGACY_PUBLIC_NAMES[user.public] ?? user.public
    const localized = publicsT?.[publicKey]?.name ?? publicsT?.[user.public]?.name
    if (localized) return localized
    const pub = PUBLICS.find(p => p.name === publicKey || p.name === user.public)
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

const DPS_LIKE_ROLES = new Set(['dps', 'dop'])

export function isDpsLikePortalRole(user) {
  return (user?.roles ?? []).some(role => DPS_LIKE_ROLES.has(role))
}

/** Titre hero accueil — DPS / DOP : compétences des collaborateurs, domaine filiale. */
export function resolveLoggedManagerHeroHeadline(user, heroT) {
  if (!isDpsLikePortalRole(user)) return null

  const personaId = resolveUserPersonaId(user) ?? 'pl'
  const persona = heroT?.personas?.[personaId] ?? heroT?.personas?.pl
  if (!persona?.headlineHighlight) return null

  return {
    prefix: heroT.logged_manager_headline_before,
    before: persona.headlineBefore,
    highlight: persona.headlineHighlight,
    after: persona.headlineAfter,
    afterBlock: persona.headlineAfterBlock,
  }
}

export function resolveLoggedHeroVisualId(user) {
  if (!user) return 'default'
  return resolveUserPersonaId(user) ?? user.persona ?? 'default'
}

/** Titre hero accueil — apprenant connecté (VL, engins…). */
export function resolveLoggedLearnerHeroHeadline(user, activeId, heroT) {
  if (!user || isDpsLikePortalRole(user)) return null

  const personaId = resolveUserPersonaId(user) ?? activeId
  const persona = heroT?.personas?.[personaId]
  if (!persona?.loggedHeadlineHighlight) return null

  return {
    prefix: heroT.logged_learner_headline_prefix,
    before: '',
    highlight: persona.loggedHeadlineHighlight,
    after: persona.headlineAfter ?? ' avec CFAO Academy',
    afterBlock: persona.headlineAfterBlock ?? true,
  }
}
