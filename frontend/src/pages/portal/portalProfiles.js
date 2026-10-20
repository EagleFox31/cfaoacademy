/**
 * Registre des profils et stratégies de tableaux de bord (Registry / Strategy Pattern).
 * Permet de déclarer de façon centralisée chaque profil métier, ses rôles associés,
 * ses métadonnées et sa stratégie d'affichage.
 */

export const ROLE_PRIORITY = [
  'superadmin',
  'build_team',
  'group_admin',
  'dps',
  'dop',
  'branch_hr',
  'branch_admin',
  'workshop_manager',
  'team_manager',
  'ki',
  'pic',
  'trainer',
  'center_director',
]

export const PORTAL_PROFILES = {
  learner: {
    key: 'learner',
    label: 'Technicien / Apprenant',
    description: 'Bilan de compétences, plan PIF, tests, certifications constructeur et assistance.',
    roles: ['learner'],
  },
  team_manager: {
    key: 'team_manager',
    label: 'Chef d’équipe',
    description: 'Supervision des techniciens d’équipe, validation des plans et suivi des résultats.',
    roles: ['team_manager'],
    mode: 'team',
  },
  workshop_manager: {
    key: 'workshop_manager',
    label: 'Chef d’atelier',
    description: 'Pilotage multi-équipes de l’atelier et plans de formation.',
    roles: ['workshop_manager'],
    mode: 'workshop',
  },
  dps: {
    key: 'dps',
    label: 'DPS / DOP',
    description: 'Direction Pièces & Services, arbitrage PIF filiale et matrice des compétences.',
    roles: ['dps', 'dop'],
  },
  branch_hr: {
    key: 'branch_hr',
    label: 'RH Filiale',
    description: 'Pilotage RH filiale, taux de certification, alertes et annuaire collaborateurs.',
    roles: ['branch_hr', 'branch_admin'],
  },
  ki: {
    key: 'ki',
    label: 'Key Instructor / PIC',
    description: 'Formations à dispenser, accompagnement des apprenants et évaluations réseau.',
    roles: ['ki', 'pic'],
  },
  superadmin: {
    key: 'superadmin',
    label: 'Super Administrateur',
    description: 'Pilotage global groupe, indicateurs multi-filiales et monitoring.',
    roles: ['superadmin'],
  },
  delivery: {
    key: 'delivery',
    label: 'Delivery & Projets Groupe',
    description: 'Gestion de projet, catalogue et déploiement.',
    roles: ['build_team', 'group_admin'],
    redirectTo: '/portail/delivery',
  },
}

/**
 * Retourne le rôle prioritaire selon la hiérarchie établie.
 */
export function getPrimaryRole(roles = []) {
  const list = Array.isArray(roles) ? roles : []
  for (const r of ROLE_PRIORITY) {
    if (list.includes(r)) return r
  }
  return 'learner'
}

/**
 * Résout la configuration du profil correspondant aux rôles donnés.
 */
export function resolveProfile(roles = []) {
  const primary = getPrimaryRole(roles)

  if (primary === 'build_team' || primary === 'group_admin') {
    return PORTAL_PROFILES.delivery
  }
  if (primary === 'superadmin') {
    return PORTAL_PROFILES.superadmin
  }
  if (primary === 'dps' || primary === 'dop') {
    return PORTAL_PROFILES.dps
  }
  if (primary === 'branch_hr' || primary === 'branch_admin') {
    return PORTAL_PROFILES.branch_hr
  }
  if (primary === 'workshop_manager') {
    return PORTAL_PROFILES.workshop_manager
  }
  if (primary === 'team_manager') {
    return PORTAL_PROFILES.team_manager
  }
  if (primary === 'ki' || primary === 'pic') {
    return PORTAL_PROFILES.ki
  }

  return PORTAL_PROFILES.learner
}
