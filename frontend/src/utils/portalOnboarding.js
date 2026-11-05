import { getPortalNavSections, getPrimaryRole } from '../data/index.js'

const STORAGE_PREFIX = 'cfao_portal_onboarding_v1'

export function onboardingStorageKey(userId, role) {
  return `${STORAGE_PREFIX}_${userId}_${role}`
}

export function hasCompletedOnboarding(userId, role) {
  if (!userId || !role) return true
  try {
    return localStorage.getItem(onboardingStorageKey(userId, role)) === 'done'
  } catch {
    return false
  }
}

export function markOnboardingComplete(userId, role) {
  if (!userId || !role) return
  try {
    localStorage.setItem(onboardingStorageKey(userId, role), 'done')
  } catch {
    /* ignore */
  }
}

export function resetOnboarding(userId, role) {
  if (!userId || !role) return
  try {
    localStorage.removeItem(onboardingStorageKey(userId, role))
  } catch {
    /* ignore */
  }
}

function pickCopy(t, key, fallbackKey) {
  return t[key] ?? t[fallbackKey] ?? ''
}

function sectionStep(section, role, t) {
  const title = pickCopy(t, `onboarding_${section.key}_title_${role}`, `onboarding_${section.key}_title`)
  const body = pickCopy(t, `onboarding_${section.key}_body_${role}`, `onboarding_${section.key}_body`)
  if (!title && !body) return null

  return {
    scrollTo: section.id,
    target: `#${section.id}`,
    targetMode: 'section',
    title,
    body,
    padding: 12,
  }
}

/** Étapes de visite guidée — défilement réel vers chaque section du portail. */
export function buildPortalOnboardingSteps(user, t) {
  if (!user?.roles?.length) return []

  const role = getPrimaryRole(user.roles)
  const sections = getPortalNavSections(user.roles)
  const steps = []

  const welcomeTitle = pickCopy(t, `onboarding_welcome_title_${role}`, 'onboarding_welcome_title')
  const welcomeBody = pickCopy(t, `onboarding_welcome_body_${role}`, 'onboarding_welcome_body')
  if (welcomeTitle || welcomeBody) {
    steps.push({
      scrollTo: null,
      target: '.portal-header-greeting-block',
      title: welcomeTitle,
      body: welcomeBody,
      padding: 14,
    })
  }

  if (role === 'dps' || role === 'dop') {
    const brandsTitle = t.onboarding_dps_brands_title
    const brandsBody = t.onboarding_dps_brands_body
    if (brandsTitle || brandsBody) {
      steps.push({
        scrollTo: null,
        target: '.portal-header-brand-levels',
        title: brandsTitle,
        body: brandsBody,
        padding: 12,
      })
    }
  }

  for (const section of sections) {
    const step = sectionStep(section, role, t)
    if (step) steps.push(step)
  }

  steps.push({
    scrollTo: null,
    scrollToTop: true,
    target: '[data-portal-locale]',
    title: t.onboarding_locale_title,
    body: t.onboarding_locale_body,
    padding: 6,
    placement: 'bottom',
  })

  steps.push({
    scrollTo: null,
    scrollToTop: true,
    target: '[data-portal-help]',
    title: t.onboarding_help_title,
    body: t.onboarding_help_body,
    padding: 6,
    placement: 'bottom',
  })

  return steps.filter(s => s.target)
}

export function resolvePortalOnboardingRole(user) {
  if (!user?.roles?.length) return null
  return getPrimaryRole(user.roles)
}
