/**
 * Accès pages détail filiale partagées DPS / KI (compétences marque, PIF tech).
 * Les écrans sont réutilisés ; le garde-fou doit autoriser KI/PIC avec le bon scope.
 */
import { getPrimaryRole } from '../data/index.js'

/**
 * @returns {{ allowed: boolean, isKi: boolean, backHash: string }}
 */
export function resolvePortalFilialeDetailAccess(roles, { dpsHash = 'resultats', kiHash = 'toyota-resultats' } = {}) {
  const primary = getPrimaryRole(roles)
  if (primary === 'dps' || primary === 'dop') {
    return { allowed: true, isKi: false, backHash: dpsHash }
  }
  if (primary === 'ki' || primary === 'pic') {
    return { allowed: true, isKi: true, backHash: kiHash }
  }
  return { allowed: false, isKi: false, backHash: dpsHash }
}
