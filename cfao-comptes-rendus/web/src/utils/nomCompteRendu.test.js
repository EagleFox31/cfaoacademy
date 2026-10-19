import { describe, it, expect } from 'vitest'
import { nomCompteRendu } from './exportEvaluation'

describe('nom du rapport', () => {
  it('suit les comptes rendus des formateurs', () => {
    const b = { intitule: 'Diagnostic des Systèmes de Climatisation', codeFormation: 'TS11-G2',
      debut: '2026-08-10', fin: '2026-08-14' }
    expect(nomCompteRendu(b, null))
      .toBe('Compte rendu formation Diagnostic des Systèmes de Climatisation du 10-14.08.26')
  })

  it('prend le code sans intitulé, et la période sur deux mois', () => {
    expect(nomCompteRendu({ codeFormation: 'TS08-G2', debut: '2026-06-29', fin: '2026-07-03' }, null))
      .toBe('Compte rendu formation TS08-G2 du 29.06-03.07.26')
  })

  it('nomme une certification par niveau et pays', () => {
    const b = { type: 'certification', codeFormation: 'TC-G3', pays: 'Guinée',
      debut: '2026-04-13', fin: '2026-04-17' }
    expect(nomCompteRendu(b, null))
      .toBe('Compte rendu Certification pratique G3 GUINÉE du 13-17.04.26')
  })
})
