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
