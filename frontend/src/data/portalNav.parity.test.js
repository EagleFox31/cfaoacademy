// Caractérisation de la navbar des portails avant la fabrique de portails
// (docs/engineering/fabrique-portails.md, étape 0) : les onglets de chaque
// rôle sont figés ; la nav dérivée des configs devra produire la même liste.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PORTAL_NAV_SECTIONS, resolvePortalNavSections } from './index.js'

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-01T09:00:00')) })
afterAll(() => { vi.useRealTimers() })

describe('onglets des portails par rôle', () => {
  it('liste figée pour tous les rôles', () => {
    expect(PORTAL_NAV_SECTIONS).toMatchSnapshot()
  })

  it('formateur : onglet des sessions toujours présent (la section dit s’il n’y en a pas)', () => {
    const ids = user => resolvePortalNavSections(['trainer'], null, user).map(s => s.id)
    expect(ids({ firstName: 'Test', lastName: 'Formateur' })).toContain('sessions-a-venir')
    expect(ids({ firstName: 'Eugène', lastName: 'EBENE' })).toEqual(PORTAL_NAV_SECTIONS.trainer.map(s => s.id))
  })
})
