import { describe, expect, it } from 'vitest'

import { resolveCardBrandBadge } from './cardBrandBadge'

describe('logo d\'une marque', () => {
  it.each([
    ['CITROEN', 'citroen.png'],
    ['Citroën', 'citroen.png'],
    ['FIAT', 'fiat.png'],
    ['JEEP', 'jeep.png'],
    ['PEUGEOT', 'peugeot.png'],
    ['BYD', 'byd.png'],
    ['OMODA & JAECOO', 'omoda.png'],
    ['TOYOTA FORKLIFT', 'toyota-forklift.png'],
  ])('%s', (marque, fichier) => {
    expect(resolveCardBrandBadge(marque).logo).toBe(`/assets/logos/${fichier}`)
  })

  it('sans logo connu : le nom', () => {
    expect(resolveCardBrandBadge('HOHAN')).toEqual({ label: 'Hohan' })
  })
})
