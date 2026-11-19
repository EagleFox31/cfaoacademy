import { canSeePlanning, centreSeul } from '../utils/planningAccess.js'

const ADMINS = ['superadmin', 'build_team', 'group_admin', 'group_hr']

/**
 * Tout ce qu'on peut mettre dans le menu du compte (avatar de la barre du haut).
 * Chaque option : libellé (clé du namespace `profile`), icône, et soit une page
 * (`to`), soit un panneau ouvert dans le menu (`panel`). `visible` filtre par rôles.
 * Ajouter une option : une entrée ici, puis son id dans USER_MENU_DEFAULT.
 */
export const USER_MENU_OPTIONS = {
  profil: { labelKey: 'menu_profile', icon: 'user', to: '/profil' },
  notifications: { labelKey: 'menu_notifications', icon: 'bell', panel: 'notifications' },
  assistance: {
    labelKey: 'menu_assistance', icon: 'lifebuoy', to: '/portail/assistance',
    visible: roles => !centreSeul(roles),
  },
  cockpit: {
    labelKey: 'menu_cockpit', icon: 'milestone', to: '/portail/delivery',
    visible: roles => roles.some(r => ADMINS.includes(r)),
  },
  cle: {
    labelKey: 'menu_cost_key', icon: 'globe', to: '/portail/cle-repartition',
    visible: roles => canSeePlanning(roles),
  },
  journal: {
    labelKey: 'menu_error_log', icon: 'lifebuoy', to: '/portail/journal-erreurs',
    visible: roles => roles.includes('superadmin'),
  },
}

/** Ce que tout compte voit aujourd'hui, partout (desktop et mobile). */
export const USER_MENU_DEFAULT = ['profil', 'notifications', 'journal']

/** Options à afficher pour ces rôles, dans l'ordre demandé ; les ids inconnus sont ignorés. */
export function userMenuItems(roles = [], ids = USER_MENU_DEFAULT) {
  return ids
    .filter(id => USER_MENU_OPTIONS[id])
    .map(id => ({ id, ...USER_MENU_OPTIONS[id] }))
    .filter(o => !o.visible || o.visible(roles))
}
