import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/planningApi', () => ({ planningApi: {} }))
const { visibleNeeds } = await import('./costKeyViews.jsx')

describe('besoin des lignes affichées, toutes filiales', () => {
  const s = (country, brand_code, month) => ({ country, brand_code, brand: brand_code.toUpperCase(), month })
  const all = [s('ci', 'toyota', 1), s('ci', 'toyota', 2), s('cm', 'toyota', 1), s('cm', 'suzuki', 1)]
  const foot = { needs_by_brand: { toyota: 30, suzuki: 7 },
    needs_by_cell: { ci: { toyota: 20 }, cm: { toyota: 10, suzuki: 7 }, ga: { toyota: 4 } } }

  it('filtre Filiale : le besoin des filiales choisies, celles sans session comprises', () => {
    const ci = all.filter(r => r.country === 'ci')
    expect(visibleNeeds(foot, all, ci, { country: ['ci', 'ga'] })).toBe(24)
  })

  it('filiale cochée sans aucune session sur ce pôle : son besoin compte quand même (0 place)', () => {
    expect(visibleNeeds(foot, all, [], { country: ['ga'] })).toBe(4)
  })

  it('filtres Filiale et Marque combinés', () => {
    expect(visibleNeeds(foot, all, [all[2]], { country: ['cm'], brand: ['TOYOTA'] })).toBe(10)
  })

  it('un autre filtre qui coupe une case : besoin inconnu', () => {
    expect(visibleNeeds(foot, all, [all[0]], { country: ['ci'] })).toBeNull()
  })

  it('sans filtre Filiale : les cases entièrement affichées', () => {
    expect(visibleNeeds(foot, all, [all[3]], {})).toBe(7)
    expect(visibleNeeds(foot, all, [all[0]], {})).toBeNull()
  })
})
