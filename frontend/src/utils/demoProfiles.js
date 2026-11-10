import { getPrimaryRole } from '../pages/portal/portalProfiles.js'

/** Libellé dans la barre démo / login (priorité au champ demoLabel). */
export function profileDemoOptionLabel(profile, t) {
  if (!profile) return ''
  if (profile.demoLabel) return profile.demoLabel
  const role = getPrimaryRole(profile.roles ?? [])
  const roleLabel = t?.[`role_${role}`] ?? role
  return `${profile.firstName} ${profile.lastName} — ${roleLabel}`
}

function demoProfileSortRank(profile) {
  if (profile?.demoSortGroup === 'cameroun') return 0
  if (profile?.medacapUsername || profile?.medacapUserId) return 0
  if (profile?.demoKicker) return 1
  return 2
}

/** Profils pilotes Cameroun / MEDACAP en tête, puis le reste par nom. */
export function sortDemoProfiles(profiles = []) {
  return [...profiles].sort((a, b) => {
    const rankDiff = demoProfileSortRank(a) - demoProfileSortRank(b)
    if (rankDiff !== 0) return rankDiff
    if (a.demoSortGroup === 'cameroun' && b.demoSortGroup === 'cameroun') {
      const order = { u12: 0, u10: 1, u9: 2, u11: 3 }
      const aOrder = order[a.id] ?? 99
      const bOrder = order[b.id] ?? 99
      if (aOrder !== bOrder) return aOrder - bOrder
    }
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')
  })
}

/** Kicker carte login démo (MEDACAP, KI pilote, ou rôle principal). */
export function demoProfileKicker(profile, t) {
  if (!profile) return ''
  if (profile.demoKicker) return profile.demoKicker
  if (profile.medacapUsername || profile.medacapUserId) return 'MEDACAP · Cameroun'
  const role = getPrimaryRole(profile.roles ?? [])
  return t?.[`role_${role}`] ?? role
}
