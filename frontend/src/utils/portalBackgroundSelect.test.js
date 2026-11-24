import { describe, expect, it } from 'vitest'
import { resolvePortalBackgroundSelection } from './portalBackgroundSelect.js'

describe('fond du portail du centre de formation', () => {
  it('le directeur a son propre portrait', () => {
    const fond = resolvePortalBackgroundSelection({ roles: ['center_director'] })
    expect(fond.key).toBe('centerDirector')
    expect(fond.src).toBe('/assets/directeur_centre_formation.jpg')
  })

  it('le coordinateur et l’assistante gardent la photo du centre', () => {
    for (const role of ['training_coordinator', 'center_assistant']) {
      expect(resolvePortalBackgroundSelection({ roles: [role] }).key).toBe('trainer')
    }
  })
})

describe('fond du portail des RH', () => {
  it('les rôles RH ont leur photo de réunion de travail, les directeurs gardent celle des administrateurs', () => {
    for (const role of ['group_hr', 'group_admin', 'branch_hr', 'branch_admin']) {
      expect(resolvePortalBackgroundSelection({ roles: [role] }).src).toBe('/assets/img_cards/devis_filiale.jpg')
    }
    for (const role of ['group_director', 'regional_director', 'branch_director', 'superadmin']) {
      expect(resolvePortalBackgroundSelection({ roles: [role] }).key).toBe('b2b')
    }
  })
})
