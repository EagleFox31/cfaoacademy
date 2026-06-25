import { getPrimaryRole } from '../pages/portal/Portal'

/** Libellé dans la barre démo / login (priorité au champ demoLabel). */
export function profileDemoOptionLabel(profile, t) {
  if (!profile) return ''
  if (profile.demoLabel) return profile.demoLabel
  const role = getPrimaryRole(profile.roles ?? [])
  const roleLabel = t?.[`role_${role}`] ?? role
  return `${profile.firstName} ${profile.lastName} — ${roleLabel}`
}

/** Profils MEDACAP en tête de liste démo. */
export function sortDemoProfiles(profiles = []) {
  return [...profiles].sort((a, b) => {
    const aLive = a.medacapUsername || a.medacapUserId ? 0 : 1
    const bLive = b.medacapUsername || b.medacapUserId ? 0 : 1
    if (aLive !== bLive) return aLive - bLive
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr')
  })
}
