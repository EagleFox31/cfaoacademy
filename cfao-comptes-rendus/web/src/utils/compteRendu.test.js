import { describe, it, expect } from 'vitest'
import { nombreDeJours, joursDeSession } from './compteRendu'

describe('jours de formation', () => {
  it('ne comptent ni les samedis ni les dimanches', () => {
    expect(nombreDeJours({ debut: '2026-09-30', fin: '2026-10-06' })).toBe(5)
  })

  it('gardent le nombre donne par le planning', () => {
    expect(nombreDeJours({ debut: '2026-09-30', fin: '2026-10-06', nbJours: 6 })).toBe(6)
  })

  it('valent un jour pour une session tenue un week-end', () => {
    expect(nombreDeJours({ debut: '2026-10-03', fin: '2026-10-04' })).toBe(1)
  })

  it('sont dates sans le week-end', () => {
    expect(joursDeSession({ debut: '2026-09-30', fin: '2026-10-06' }).map(j => j.date))
      .toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'])
  })
})
