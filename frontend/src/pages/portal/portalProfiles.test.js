import { describe, expect, it } from 'vitest'
import { CONSULTATION_MODES, getPrimaryRole, resolveProfile, ROLE_PRIORITY } from './portalProfiles.js'
import { resolveView } from './Portal.jsx'
import { getPortalNavSections, ROLE_PRIORITY as NAV_PRIORITY } from '../../data/index.js'
import { canAccessDelivery } from '../../utils/deliveryAccess.js'
import { pageAccueil } from '../../utils/planningAccess.js'

describe('aiguillage des rôles sans portail', () => {
  it('build_team arrive sur le Super Admin, sans redirection vers le Delivery', () => {
    expect(resolveProfile(['build_team']).key).toBe('superadmin')
    expect(resolveView(['build_team'])).toEqual({ vue: 'superadmin' })
  })

  it.each([
    ['group_hr', 'group'],
    ['group_director', 'group'],
    ['group_admin', 'group'],
    ['regional_director', 'direction'],
    ['branch_director', 'direction'],
  ])('%s : profil %s, portail de consultation dans son mode', (role, key) => {
    expect(resolveProfile([role])).toMatchObject({ key, mode: role })
    expect(resolveView([role])).toEqual({ vue: 'consultation', props: { mode: role } })
    expect(pageAccueil([role])).toBe('/portail')
  })

  it('admin groupe = réunion des sections RH groupe et directeur groupe', () => {
    const { group_hr, group_director, group_admin } = CONSULTATION_MODES
    const union = new Set([...group_hr.sections, ...group_director.sections])
    expect(new Set(group_admin.sections)).toEqual(union)
  })

  it('recrutement fermé par défaut à la RH groupe', () => {
    expect(CONSULTATION_MODES.group_hr.sections).not.toContain('recrutement')
    expect(getPortalNavSections(['group_hr']).map(s => s.id)).not.toContain('recrutement')
  })

  it('le plus haut rôle gagne : admin groupe avant directeur groupe, directeur de filiale avant DPS', () => {
    expect(getPrimaryRole(['group_director', 'group_admin'])).toBe('group_admin')
    expect(resolveProfile(['dps', 'branch_director']).mode).toBe('branch_director')
  })

  it('une seule priorité : la navbar suit le portail affiché', () => {
    expect(NAV_PRIORITY).toBe(ROLE_PRIORITY)
    for (const [role, { sections }] of Object.entries(CONSULTATION_MODES)) {
      const ids = getPortalNavSections([role]).map(s => s.id)
      expect(ids).toEqual(sections.filter(s => s !== 'a-traiter'))
    }
  })

  it('pas de Delivery pour le directeur groupe', () => {
    expect(canAccessDelivery(['group_director'])).toBe(false)
    expect(canAccessDelivery(['build_team'])).toBe(true)
  })
})
