import { describe, expect, it } from 'vitest'
import { periodeLongue } from './dates.js'

describe('periodeLongue', () => {
  it('ne repete pas le mois quand la session tient dans un mois', () => {
    expect(periodeLongue('2026-09-14', '2026-09-18')).toBe('du 14 au 18 septembre 2026')
  })

  it('donne les deux dates quand la session chevauche deux mois', () => {
    expect(periodeLongue('2026-09-28', '2026-10-02'))
      .toBe('du 28 septembre 2026 au 2 octobre 2026')
  })

  it('reste vide sans dates', () => {
    expect(periodeLongue('', '')).toBe('')
  })
})
