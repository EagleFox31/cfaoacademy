/** Clé i18n `portal_orient_*` sous le titre de salutation — une par portail. */
export const PORTAL_ORIENT_KEY_BY_ROLE = {
  learner: 'portal_orient_learner',
  ki: 'portal_orient_ki',
  pic: 'portal_orient_ki',
  team_manager: 'portal_orient_team_manager',
  workshop_manager: 'portal_orient_workshop_manager',
  branch_hr: 'portal_orient_branch_hr',
  branch_admin: 'portal_orient_branch_hr',
  superadmin: 'portal_orient_superadmin',
  trainer: 'portal_orient_trainer',
  center_director: 'portal_orient_trainer',
}

export function resolvePortalOrientKey(primaryRole) {
  return PORTAL_ORIENT_KEY_BY_ROLE[primaryRole] ?? PORTAL_ORIENT_KEY_BY_ROLE.learner
}
