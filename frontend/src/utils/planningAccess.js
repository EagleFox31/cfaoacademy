/**
 * Menu du module « Clé de répartition », par rôle.
 *
 * Ce que l'utilisateur peut faire vient de l'API (GET /api/v1/planning/access,
 * décidé par Cerbos) : le front n'invente aucun droit, il masque seulement.
 *
 * Règles de menu (publics pressés, peu à l'aise avec l'informatique) :
 *   - 6 entrées au plus (Academy), toutes visibles, sans sous-menu ni menu déroulant ;
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

/** Équipe du centre de formation : pour l'instant, la clé de répartition et rien d'autre. */
const CENTER_ROLES = ['center_director', 'center_assistant', 'training_coordinator']

/** Vrai pour un compte du centre sans autre rôle de portail. */
export function cleSeule(roles = []) {
  return roles.some(r => CENTER_ROLES.includes(r))
    && !roles.some(r => ROLE_PRIORITY.includes(r) && !CENTER_ROLES.includes(r))
}

/**
 * Page d'arrivée après connexion, sans page de retour demandée :
 * sans rôle de portail mais avec un rôle planning, le portail apprenant n'a
 * rien à lui montrer, on l'envoie droit sur la clé de répartition.
 */
export function pageAccueil(roles = []) {
  const rolePortail = roles.some(r => ROLE_PRIORITY.includes(r))
  return cleSeule(roles) || (!rolePortail && canSeePlanning(roles)) ? PLANNING_HOME : '/portail'
}

/**
 * @param {{view, manage, freeze, import, gaps}} access — réponse de /access
 * @param {{scoped?: boolean, roles?: string[]}} opts — scoped : l'utilisateur ne voit que ses pays
 * @returns {string[]} identifiants des vues, dans l'ordre d'affichage
 */
export function planningMenu(access, { scoped = false, roles = [] } = {}) {
  if (!access?.view) return []
  // Une filiale vient d'abord voir SA filiale ; le groupe vient voir le tableau.
  // La vue « abc » existe toujours (AbcView) : retirée du menu pour l'instant, à la demande du métier.
  const items = scoped ? ['country', 'table'] : ['table', 'country']
  if (access.gaps) items.push('themes')
  if (access.manage) items.push('settings')
  // Imports et gel relèvent du coordinateur : le directeur du centre n'a pas ce menu.
  const directeurSeul = roles.includes('center_director') && !roles.includes('training_coordinator')
  if (!directeurSeul && (access.manage || access.import || access.freeze)) items.push('prepare')
  return items.slice(0, 6)
}
