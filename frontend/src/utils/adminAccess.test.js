import { describe, expect, it } from 'vitest'
import { ADMIN_MODULE_IDS, ADMIN_NAV, adminPath, canAccessAdminConsole } from './adminAccess.js'

describe('canAccessAdminConsole', () => {
  it('ouvre la console au super admin, même avec d\'autres rôles', () => {
    expect(canAccessAdminConsole(['superadmin'])).toBe(true)
    expect(canAccessAdminConsole(['learner', 'superadmin'])).toBe(true)
  })

  it('la ferme aux autres rôles et sans rôle', () => {
    for (const roles of [['build_team'], ['group_admin'], ['content_editor'], [], undefined, null]) {
      expect(canAccessAdminConsole(roles)).toBe(false)
    }
  })
})

describe('menu de la console', () => {
  it('a des identifiants uniques, accueil compris', () => {
    expect(new Set(ADMIN_MODULE_IDS).size).toBe(ADMIN_MODULE_IDS.length)
    expect(ADMIN_MODULE_IDS[0]).toBe('overview')
  })

  it('donne un état connu à chaque entrée', () => {
    for (const item of ADMIN_NAV.flatMap(g => g.items)) {
      expect(['readonly', 'construction', 'live']).toContain(item.status)
    }
  })

  it('construit les adresses', () => {
    expect(adminPath()).toBe('/portail/admin')
    expect(adminPath('accounts')).toBe('/portail/admin/accounts')
  })
})
