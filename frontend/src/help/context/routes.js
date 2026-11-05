/** Contexte d'aide selon la route / ancre — sans dépendre du portail existant. */
export function resolveHelpContext({ pathname = '', hash = '' } = {}) {
  const cleanHash = (hash || '').replace(/^#/, '').trim()

  if (pathname.startsWith('/portail/competences')) return 'resultats'
  if (pathname.startsWith('/portail/technicien')) return 'pif'
  if (pathname.startsWith('/portail/assistance')) return 'assistance'
  if (pathname.startsWith('/portail/resultats')) return 'resultats'
  if (pathname.startsWith('/portail/delivery')) return 'pif'
  if (pathname === '/portail/aide') return 'portal-home'

  if (pathname === '/portail' || pathname === '/portail/') {
    if (cleanHash) return cleanHash
    return 'portal-home'
  }

  if (pathname.startsWith('/portail')) return 'portal-home'

  return null
}

/** Sections portail connues → clé micro-tour (futur). */
export const HELP_SECTION_TOUR_KEYS = {
  pif: 'section-pif',
  plans: 'section-plans',
  resultats: 'section-results',
  tests: 'section-tests',
  certifs: 'section-certifs',
  assistance: 'section-assistance',
  equipe: 'section-team',
  equipes: 'section-teams',
  bilan: 'section-overview',
  activite: 'section-activity',
  collaborateurs: 'section-collaborators',
}

export function resolveSectionTourKey(contextKey) {
  if (!contextKey) return null
  return HELP_SECTION_TOUR_KEYS[contextKey] ?? null
}
