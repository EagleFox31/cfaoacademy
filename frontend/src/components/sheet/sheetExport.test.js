import { describe, expect, it } from 'vitest'
import { makeFormatter, toCsv } from './sheetExport'

describe('devise en sortie', () => {
  it('la met dans le titre et garde un nombre dans la cellule', () => {
    const columns = [{ id: 'm', header: 'Montant', group: 'Totaux', type: 'money', unit: 'FCFA', value: r => r.m }]
    const csv = toCsv({ columns, rows: [{ m: 1500 }], locale: 'fr', format: makeFormatter('fr') })
    expect(csv.replace('﻿', '')).toBe('Totaux · Montant (FCFA)\r\n1500')
  })
})

// Intl sépare par des espaces insécables : on les normalise pour comparer.
const compact = value => makeFormatter('fr')(value, 'compact').replace(/\s/g, ' ')

describe('format compact', () => {
  it('garde les petits montants entiers', () => {
    expect(compact(850)).toBe('850')
  })

  it('passe en K puis en M', () => {
    expect(compact(12_500)).toBe('12,5 K')
    expect(compact(42_800_000)).toBe('42,8 M')
  })

  it("n'écrit jamais 1 000 K", () => {
    expect(compact(999_950)).toBe('1 M')
    expect(compact(999.96)).toBe('1 K')
  })
})
