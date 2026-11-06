/**
 * Menu du module « Clé de répartition », par rôle.
 *
 * Ce que l'utilisateur peut faire vient de l'API (GET /api/v1/planning/access,
 * décidé par Cerbos) : le front n'invente aucun droit, il masque seulement.
 *
 * Règles de menu (publics pressés, peu à l'aise avec l'informatique) :
 *   - 5 entrées au plus, toutes visibles, sans sous-menu ni menu déroulant ;
 *   - un mot ou deux, du vocabulaire métier, et une ligne d'aide sous chaque entrée ;
 *   - toujours le même ordre : la tâche principale du rôle d'abord ;
 *   - une entrée sans droit n'est pas grisée, elle n'existe pas.
 */
import { ROLE_PRIORITY } from '../data/index.js'

/** Rôles qui voient l'entrée dans la navbar (reflet de cerbos/policies/derived_roles/planning.yaml). */
export const PLANNING_ROLES = [
  'planning_viewer', 'center_assistant', 'training_coordinator', 'center_director', 'superadmin',
  'dps', 'dop', 'workshop_manager', 'branch_director', 'branch_admin',
  'regional_director', 'group_director', 'group_admin',
]

export function canSeePlanning(roles = []) {
  return roles.some(r => PLANNING_ROLES.includes(r))
}

export const PLANNING_HOME = '/portail/cle-repartition'

/**
 * Page d'arrivée après connexion, sans page de retour demandée :
 * sans rôle de portail mais avec un rôle planning, le portail apprenant n'a
 * rien à lui montrer, on l'envoie droit sur la clé de répartition.
 */
export function pageAccueil(roles = []) {
  const rolePortail = roles.some(r => ROLE_PRIORITY.includes(r))
  return !rolePortail && canSeePlanning(roles) ? PLANNING_HOME : '/portail'
}

/**
 * @param {{view, manage, freeze, import, gaps}} access — réponse de /access
 * @param {{scoped?: boolean}} opts — scoped : l'utilisateur ne voit que ses pays
 * @returns {string[]} identifiants des vues, dans l'ordre d'affichage
 */
export function planningMenu(access, { scoped = false } = {}) {
  if (!access?.view) return []
  // Une filiale vient d'abord voir SON pays ; le groupe vient voir le tableau.
  const items = scoped ? ['country', 'table', 'compare'] : ['table', 'country', 'compare']
  if (access.gaps) items.push('themes')
  if (access.manage || access.import || access.freeze) items.push('prepare')
  return items.slice(0, 5)
}
