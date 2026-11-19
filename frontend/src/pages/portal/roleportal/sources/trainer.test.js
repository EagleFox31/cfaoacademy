import { describe, expect, it } from 'vitest'
import { marquesDuFormateur } from '../../../../utils/catalogFormateur.js'
import { filterTicketsForBrands } from '../../../../utils/assistanceTickets.js'
import { assistanceDu } from './trainer.js'

describe('assistance du formateur', () => {
  it('lit ses marques dans l’équipe des pôles, accents et casse ignorés', () => {
    expect(marquesDuFormateur('Eugène EBENE')).toEqual(['toyota'])
    expect(marquesDuFormateur('eugene ebene')).toEqual(['toyota'])
    expect(marquesDuFormateur('Jacques MAVILA')).toEqual(['toyota', 'suzuki'])
    expect(marquesDuFormateur('Inconnu')).toEqual([])
    expect(marquesDuFormateur('')).toEqual([])
  })

  it('ne garde que les tickets de ses marques', () => {
    const tickets = [{ id: 1, brand: 'toyota' }, { id: 2, brand: 'hino' }, { id: 3, brand: 'suzuki' }]
    expect(filterTicketsForBrands(tickets, ['toyota', 'suzuki']).map(t => t.id)).toEqual([1, 3])
    expect(filterTicketsForBrands(tickets, [])).toEqual([])
  })

  it('donne à chaque formateur les demandes de ses marques seulement', () => {
    const eugene = assistanceDu({ firstName: 'Eugène', lastName: 'EBENE' })
    expect(eugene.length).toBeGreaterThan(0)
    expect(new Set(eugene.map(t => t.brand))).toEqual(new Set(['toyota']))

    const jacques = assistanceDu({ firstName: 'Jacques', lastName: 'MAVILA' })
    expect(new Set(jacques.map(t => t.brand))).toEqual(new Set(['toyota', 'suzuki']))

    expect(assistanceDu({ firstName: 'Test', lastName: 'Formateur' })).toEqual([])
  })
})
