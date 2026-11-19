/**
 * Console d'administration (super admin) : accès et menu.
 *
 * La garde côté écran n'est que de l'ergonomie : chaque appel d'API reste
 * contrôlé par Cerbos côté serveur. Module pur : ni React, ni `data/index.js`.
 */

const ADMIN_ROLES = new Set(['superadmin'])

export function canAccessAdminConsole(roles = []) {
  return (roles ?? []).some(r => ADMIN_ROLES.has(r))
}

/**
 * Menu de la console, groupé. `status` :
 *  - `readonly` : branché, en lecture ;
 *  - `construction` : écran d'attente, rien d'inventé.
 */
export const ADMIN_NAV = [
  { group: 'nav_group_people', items: [
    { id: 'accounts', ico: '◉', status: 'readonly' },
    { id: 'roles', ico: '⚿', status: 'readonly' },
  ] },
  { group: 'nav_group_content', items: [
    { id: 'portals', ico: '▦', status: 'readonly' },
    { id: 'articles', ico: '✎', status: 'readonly' },
  ] },
  { group: 'nav_group_project', items: [
    { id: 'project', ico: '⚑', status: 'readonly' },
    { id: 'github', ico: '⎇', status: 'construction' },
  ] },
]

export const ADMIN_HOME = 'overview'

export const ADMIN_MODULE_IDS = [ADMIN_HOME, ...ADMIN_NAV.flatMap(g => g.items.map(i => i.id))]

export function adminPath(id = ADMIN_HOME) {
  return id === ADMIN_HOME ? '/portail/admin' : `/portail/admin/${id}`
}
