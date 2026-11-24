/**
 * Comptes vus par la console d'administration : libellés et filtres.
 * Aucun identifiant technique à l'écran : rôles et filiales en clair.
 * Module pur : ni React, ni `data/index.js`.
 */

/** Libellé d'un rôle : textes du portail, puis de la console, puis catalogue serveur. */
export function roleLabel(code, { tPortal = {}, tAdmin = {}, catalog = [] } = {}) {
  const key = `role_${code}`
  return tPortal[key] ?? tAdmin[key] ?? catalog.find(r => r.code === code)?.description ?? code
}

/** Codes les plus profonds d'un périmètre (ceux qui ne sont l'ancêtre d'aucun autre). */
export function leafCodes(paths = []) {
  return paths.filter(p => !paths.some(o => o !== p && o.startsWith(`${p}.`)))
}

/**
 * Filiale(s) d'un compte, en clair. `units` = unités de l'organisation
 * ({ code, name, kind }). Un compte rattaché au seul groupe → « Tout le groupe ».
 */
export function branchLabel(paths = [], units = [], groupLabel = '') {
  const leaves = leafCodes(paths)
  if (leaves.length === 0) return ''
  const byCode = new Map(units.map(u => [u.code, u]))
  return leaves
    .map(code => {
      const unit = byCode.get(code)
      if (unit?.kind === 'group' || (!unit && !code.includes('.'))) return groupLabel
      return unit?.name ?? code.split('.').pop().toUpperCase()
    })
    .join(', ')
}

/** Nom affiché d'un compte : prénom + nom, sinon l'e-mail. */
export function displayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  return name || user?.email || ''
}

/** Filtre texte (nom, e-mail) et rôle. */
export function filterAccounts(users = [], { q = '', role = 'all' } = {}) {
  const needle = q.trim().toLowerCase()
  return users.filter(u => {
    if (role !== 'all' && !(u.roles ?? []).includes(role)) return false
    if (!needle) return true
    return `${displayName(u)} ${u.email ?? ''}`.toLowerCase().includes(needle)
  })
}

/** Nombre de comptes par rôle : { [code]: n }. */
export function roleCounts(users = []) {
  const out = {}
  for (const u of users) for (const r of u.roles ?? []) out[r] = (out[r] ?? 0) + 1
  return out
}

/** `{n}` remplacé, et forme `_one` quand n <= 1 (même convention que les portails). */
export function plural(t, key, n) {
  const modele = (n <= 1 && t[`${key}_one`]) || t[key] || ''
  return modele.replaceAll('{n}', n)
}
