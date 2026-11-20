import { describe, expect, it } from 'vitest'
import {
  aggregate, cellAddress, colLetter, coverageTone, inRange, isRowSelected, mergeSpans, normRange, parseFilter,
  spanInRange, toTSV, parseCellInput, sameCell,
} from './sheetMath'

describe('saisie dans une cellule', () => {
  const seats = { input: 'number', min: 1, max: 32767 }

  it('accepte un entier, espaces de milliers compris, dans les bornes', () => {
    expect(parseCellInput('12', seats)).toEqual({ ok: true, value: 12 })
    expect(parseCellInput(' 1 200 ', seats)).toEqual({ ok: true, value: 1200 })
  })

  it('refuse le vide, les décimales, le négatif et le hors bornes', () => {
    for (const bad of ['', 'abc', '1,5', '-3', '0', '40000']) {
      expect(parseCellInput(bad, seats)).toEqual({ ok: false })
    }
  })

  it('accepte une date ISO réelle ou vide, refuse le reste', () => {
    const date = { input: 'date' }
    expect(parseCellInput('2027-02-28', date)).toEqual({ ok: true, value: '2027-02-28' })
    expect(parseCellInput('', date)).toEqual({ ok: true, value: '' })
    expect(parseCellInput('2027-02-31', date)).toEqual({ ok: false })
    expect(parseCellInput('28/02/2027', date)).toEqual({ ok: false })
  })

  it('compare la saisie à la valeur de départ sans tenir compte du type', () => {
    expect(sameCell(6, 6)).toBe(true)
    expect(sameCell('', null)).toBe(true)
    expect(sameCell(7, 6)).toBe(false)
  })
})

describe('fusion verticale', () => {
  it('regroupe les valeurs égales consécutives', () => {
    expect(mergeSpans(['A', 'A', 'B', 'B', 'B', 'C'])).toEqual([2, 0, 3, 0, 0, 1])
  })

  it('ne fusionne pas des valeurs égales séparées, ni des cases vides', () => {
    expect(mergeSpans(['A', 'B', 'A'])).toEqual([1, 1, 1])
    expect(mergeSpans(['', '', null, null])).toEqual([1, 1, 1, 1])
  })

  it('renvoie un tableau vide sans ligne', () => {
    expect(mergeSpans([])).toEqual([])
  })

  it('ne sélectionne la cellule fusionnée que si toutes ses lignes le sont', () => {
    const uneLigne = { r0: 3, r1: 3, c0: 0, c1: 0 }
    const bloc = { r0: 2, r1: 4, c0: 0, c1: 0 }
    expect(spanInRange(uneLigne, 2, 3, 0)).toBe(false)
    expect(spanInRange(uneLigne, 3, 1, 0)).toBe(true)
    expect(spanInRange(bloc, 2, 3, 0)).toBe(true)
    expect(spanInRange(bloc, 2, 3, 1)).toBe(false)
    expect(spanInRange(null, 2, 3, 0)).toBe(false)
  })
})

describe('ligne sélectionnée', () => {
  const lastRow = 9
  const lastCol = 5
  const lit = (a, b, row) => isRowSelected(normRange(a, b), row, lastRow, lastCol)

  it('colore la ligne de la cellule cliquée, et elle seule', () => {
    const cell = { row: 3, col: 2 }
    expect(lit(cell, cell, 3)).toBe(true)
    expect(lit(cell, cell, 4)).toBe(false)
  })

  it('colore chaque ligne de la plage et la ligne choisie par son numéro', () => {
    expect(lit({ row: 2, col: 1 }, { row: 4, col: 1 }, 3)).toBe(true)
    expect(lit({ row: 6, col: 0 }, { row: 6, col: lastCol }, 6)).toBe(true)
  })

  it('ne colore aucune ligne pour une colonne entière, sauf si tout le tableau est pris', () => {
    expect(lit({ row: 0, col: 2 }, { row: lastRow, col: 2 }, 5)).toBe(false)
    expect(lit({ row: 0, col: 0 }, { row: lastRow, col: lastCol }, 5)).toBe(true)
  })

  it('colore la ligne unique d\'un tableau et rien sans sélection', () => {
    const cell = { row: 0, col: 1 }
    expect(isRowSelected(normRange(cell, cell), 0, 0, lastCol)).toBe(true)
    expect(isRowSelected(null, 0, lastRow, lastCol)).toBe(false)
  })
})

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
