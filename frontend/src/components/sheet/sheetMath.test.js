import { describe, expect, it } from 'vitest'
import {
  aggregate, cellAddress, colLetter, coverageTone, inRange, normRange, parseFilter, toTSV,
} from './sheetMath'

describe('en-têtes façon Excel', () => {
  it('numérote les colonnes en lettres', () => {
    expect([0, 25, 26, 27, 701, 702].map(colLetter)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
    expect(cellAddress(2, 4)).toBe('C5')
  })
})

describe('filtres de colonne', () => {
  it('texte : contient, sans casse ni accents', () => {
    const f = parseFilter('cote')
    expect(f("Côte d'Ivoire")).toBe(true)
    expect(f('Cameroun')).toBe(false)
  })
  it('comparaisons et plages numériques', () => {
    expect([5, 10, 15].filter(parseFilter('>=10'))).toEqual([10, 15])
    expect([5, 10, 15].filter(parseFilter('<>10'))).toEqual([5, 15])
    expect([5, 10, 15].filter(parseFilter('6..12'))).toEqual([10])
    expect(parseFilter('>1 000')(2000)).toBe(true)
  })
  it('pourcentage : « <50 » se lit 50 %', () => {
    const f = parseFilter('<50', { percent: true })
    expect(f(0.4)).toBe(true)
    expect(f(0.6)).toBe(false)
  })
  it('cellules vides et filtre vide', () => {
    expect([null, '', 3].filter(parseFilter('(vide)'))).toEqual([null, ''])
    expect(parseFilter('  ')).toBeNull()
  })
})

describe('barre d\'état', () => {
  it('somme, moyenne, nombre, min, max des nombres sélectionnés', () => {
    expect(aggregate([2, 4, 'x', null, 6])).toEqual({
      count: 4, numCount: 3, sum: 12, avg: 4, min: 2, max: 6,
    })
    expect(aggregate(['a', null]).sum).toBeNull()
  })
})

describe('sélection et presse-papier', () => {
  it('normalise un rectangle tiré dans n\'importe quel sens', () => {
    const r = normRange({ row: 3, col: 2 }, { row: 1, col: 0 })
    expect(r).toEqual({ r0: 1, r1: 3, c0: 0, c1: 2 })
    expect(inRange(r, 2, 1)).toBe(true)
    expect(inRange(r, 4, 1)).toBe(false)
  })
  it('produit un TSV collable dans Excel', () => {
    expect(toTSV([['Pays', 'Places'], ['Cameroun', 6], ['a\tb', null]]))
      .toBe('Pays\tPlaces\nCameroun\t6\n"a\tb"\t')
  })
  it('teinte la couverture', () => {
    expect([0.2, 0.6, 0.9, null].map(coverageTone)).toEqual(['low', 'mid', 'high', null])
  })
})
