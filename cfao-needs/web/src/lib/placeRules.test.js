import { describe, expect, it } from 'vitest'

import { placeOptionsFor, resolvePlace } from './placeRules'

describe('lieu de formation', () => {
  it('propose le distanciel hors Cameroun, dès 1 personne', () => {
    expect(placeOptionsFor('Madagascar', 1)).toEqual(['CFR', 'FILIALE', 'DISTANCE'])
  })

  it('garde Douala seul au Cameroun jusqu’à 6 personnes', () => {
    expect(placeOptionsFor('Cameroun', 6)).toEqual(['CFR'])
    expect(resolvePlace('Cameroun', 6, 'DISTANCE')).toBe('CFR')
  })

  it('conserve le distanciel demandé', () => {
    expect(resolvePlace('Madagascar', 4, 'DISTANCE')).toBe('DISTANCE')
    expect(resolvePlace('Cameroun', 7, 'DISTANCE')).toBe('DISTANCE')
  })

  it('ramène une valeur inconnue sur Douala', () => {
    expect(resolvePlace('Madagascar', 4, 'AUTRE')).toBe('CFR')
  })
})
