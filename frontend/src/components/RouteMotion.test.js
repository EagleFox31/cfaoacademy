import { describe, expect, it } from 'vitest'
import { routeScope } from './RouteMotion.jsx'

describe('routeScope', () => {
  it("regroupe les vues d'un écran applicatif sous son préfixe", () => {
    expect(routeScope('/portail/cle-repartition')).toBe('/portail/cle-repartition')
    expect(routeScope('/portail/cle-repartition/country')).toBe('/portail/cle-repartition')
    expect(routeScope('/portail/cle-repartition/themes')).toBe('/portail/cle-repartition')
  })

  it('laisse les autres chemins inchangés (loader à chaque route)', () => {
    expect(routeScope('/portail')).toBe('/portail')
    expect(routeScope('/formations')).toBe('/formations')
    expect(routeScope('/portail/cle-repartitionx')).toBe('/portail/cle-repartitionx')
  })
})
