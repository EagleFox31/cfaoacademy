/**
 * Registre des profils et stratégies de tableaux de bord (Registry / Strategy Pattern).
 * Permet de déclarer de façon centralisée chaque profil métier, ses rôles associés,
 * ses métadonnées et sa stratégie d'affichage.
 */

export const ROLE_PRIORITY = [
  'superadmin',
  'build_team',
  'group_admin',
  'group_hr',
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
  'training_coordinator',
  'center_assistant',
]

/** Mode du portail du centre de formation, par rôle. */
const CENTER_MODES = {
  center_director: 'director',
  training_coordinator: 'coordinator',
  center_assistant: 'assistant',
}

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
  group_hr: {
    key: 'group_hr',
    label: 'RH Groupe',
    description: 'Vue groupe en consultation : recrutement, mesure des compétences, PIF, techniciens et candidats.',
    roles: ['group_hr'],
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
  center: {
    key: 'center',
    label: 'Centre de formation',
    description: 'Clé de répartition, devis des filiales, besoins et taux de remplissage.',
    roles: ['center_director', 'training_coordinator', 'center_assistant'],
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
  if (primary === 'group_hr') {
    return PORTAL_PROFILES.group_hr
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
  if (CENTER_MODES[primary]) {
    return { ...PORTAL_PROFILES.center, mode: CENTER_MODES[primary] }
  }

  return PORTAL_PROFILES.learner
}
