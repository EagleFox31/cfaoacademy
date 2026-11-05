/** Pastels « poste » tableau DPS — distincts des couleurs palier MEDACAP (pas vert / orange vif). */

import { competencyTierForCertLevel } from './learnerTests.js'

export const DPS_TECHNICIAN_ROLE_LABEL_KEY = {
  junior: 'dps_role_maintenancier',
  senior: 'dps_role_reparateur',
  expert: 'dps_role_diagnostiqueur',
}

export function normalizeDpsTechnicianRoleTier(tier) {
  if (!tier) return null
  return competencyTierForCertLevel(tier) ?? (tier === 'senior' || tier === 'expert' ? tier : 'junior')
}

export function dpsTechnicianRoleBadgeClass(tier) {
  const key = normalizeDpsTechnicianRoleTier(tier)
  if (!key) return 'portal-dps-role-badge portal-dps-role-badge--unknown'
  return `portal-dps-role-badge portal-dps-role-badge--${key}`
}

export function dpsTechnicianRoleTableWrapClass(tier) {
  return `portal-dps-tier-table-wrap--${normalizeDpsTechnicianRoleTier(tier)}`
}

export function resolveDpsTechnicianRoleLabel(tier, t) {
  const key = DPS_TECHNICIAN_ROLE_LABEL_KEY[normalizeDpsTechnicianRoleTier(tier)]
  return key && t?.[key] ? t[key] : ''
}
