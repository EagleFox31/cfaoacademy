/**
 * Registre des profils et stratégies de tableaux de bord (Registry / Strategy Pattern).
 * Permet de déclarer de façon centralisée chaque profil métier, ses rôles associés,
 * ses métadonnées et sa stratégie d'affichage.
 */

/**
 * Priorité des rôles (le plus haut gagne). Source unique : la navbar, la pastille
 * de rôle et le portail affiché en dérivent, pour désigner toujours le même rôle.
 */
export const ROLE_PRIORITY = [
  'superadmin',
  'build_team',
  'group_admin',
  'group_director',
  'group_hr',
  'regional_director',
  'branch_director',
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

/**
 * Portail de consultation (RHHome) : sections affichées par rôle, dans l'ordre de
 * la page (docs/engineering/matrice-sections-portail.html). La navbar s'y aligne.
 * Hors périmètre groupe, les jeux de démo ne s'appliquent pas : résultats et PIF
 * restent en construction jusqu'à leur branchement.
 */
export const CONSULTATION_MODES = {
  // Recrutement fermé par défaut à la RH groupe (18/11) : il s'ouvrira depuis la
  // plateforme (matrice d'accès du Super Admin). La section reste dans RHHome.
  group_hr: { perimetre: 'groupe', sections: ['a-traiter', 'competences', 'pif', 'personnes'] },
  group_admin: { perimetre: 'groupe', sections: ['a-traiter', 'competences', 'pif', 'personnes', 'cle'] },
  group_director: { perimetre: 'groupe', sections: ['competences', 'pif', 'cle'] },
  regional_director: { perimetre: 'region', sections: ['competences', 'pif', 'cle'] },
  branch_director: { perimetre: 'filiale', sections: ['competences', 'pif', 'cle'] },
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
  group: {
    key: 'group',
    label: 'Groupe',
    description: 'Vue groupe en consultation : RH groupe, directeur groupe, admin groupe (réunion des deux).',
    roles: ['group_hr', 'group_director', 'group_admin'],
  },
  direction: {
    key: 'direction',
    label: 'Direction filiale / région',
    description: 'Résultats de compétences et PIF en vue macro, clé de répartition de son périmètre.',
    roles: ['branch_director', 'regional_director'],
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
    description: 'Pilotage global groupe, indicateurs multi-filiales, monitoring et Delivery.',
    roles: ['superadmin', 'build_team'],
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

  // Le Delivery est le Super Admin : build_team y arrive, section Delivery comprise.
  if (primary === 'superadmin' || primary === 'build_team') {
    return PORTAL_PROFILES.superadmin
  }
  if (CONSULTATION_MODES[primary]) {
    const profil = primary.startsWith('group_') ? PORTAL_PROFILES.group : PORTAL_PROFILES.direction
    return { ...profil, mode: primary }
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
