import { describe, expect, it } from 'vitest'
import fr from '../i18n/locales/fr/profile.json'
import en from '../i18n/locales/en/profile.json'
import pt from '../i18n/locales/pt/profile.json'
import { USER_MENU_DEFAULT, USER_MENU_OPTIONS, userMenuItems } from './userMenu.js'

const ids = (roles, items) => userMenuItems(roles, items).map(o => o.id)

describe('menu du compte', () => {
  it('par défaut, tout compte a son profil et ses notifications', () => {
    expect(USER_MENU_DEFAULT).toEqual(['profil', 'notifications', 'propositions', 'journal', 'supervision'])
    for (const roles of [['learner'], ['trainer'], []]) {
      expect(ids(roles)).toEqual(['profil', 'notifications'])
    }
  })

  it('par défaut, le superadmin garde le journal des erreurs et la supervision', () => {
    expect(ids(['superadmin'])).toEqual(['profil', 'notifications', 'propositions', 'journal', 'supervision'])
  })

  it('« Mes propositions » : directeur du centre et superadmin seulement (comme Cerbos)', () => {
    expect(ids(['center_director'])).toEqual(['profil', 'notifications', 'propositions'])
    for (const r of ['training_coordinator', 'trainer', 'dps', 'learner']) expect(ids([r])).not.toContain('propositions')
  })

  it('l’exploitant voit la supervision, pas le journal des erreurs', () => {
    expect(ids(['platform_ops'])).toEqual(['profil', 'notifications', 'supervision'])
  })

  it('une option réservée ne s’affiche qu’aux rôles prévus', () => {
    const tout = Object.keys(USER_MENU_OPTIONS)
    expect(ids(['superadmin'], tout)).toEqual(expect.arrayContaining(['cockpit', 'journal']))
    expect(ids(['learner'], tout)).not.toContain('journal')
    expect(ids(['center_director'], tout)).not.toContain('assistance')
  })

  it('un id inconnu est ignoré, l’ordre demandé est gardé', () => {
    expect(ids(['superadmin'], ['notifications', 'inconnu', 'profil'])).toEqual(['notifications', 'profil'])
  })

  it('chaque option a son libellé en fr, en et pt', () => {
    const cles = Object.keys(fr).sort()
    expect(Object.keys(en).sort()).toEqual(cles)
    expect(Object.keys(pt).sort()).toEqual(cles)
    for (const o of Object.values(USER_MENU_OPTIONS)) expect(fr[o.labelKey]).toBeTruthy()
  })
})
