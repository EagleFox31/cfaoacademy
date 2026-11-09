import { describe, it, expect } from 'vitest'
import {
  lireNote, nettoyerNote, enPourcentage, calculer, syntheseGroupe, anomalies,
} from './baremeCfao'

describe('nettoyerNote', () => {
  it('garde la virgule : « 12,5 » ne devient plus « 125 »', () => {
    expect(nettoyerNote('12,5')).toBe('12,5')
    expect(nettoyerNote('12.5')).toBe('12.5')
  })
  it('limite à une décimale et un seul séparateur', () => {
    expect(nettoyerNote('12,55')).toBe('12,5')
    expect(nettoyerNote('12,5,3')).toBe('12,5')
    expect(nettoyerNote('1a2 ,x5')).toBe('12,5')
  })
  it('laisse la saisie en cours et le champ vide', () => {
    expect(nettoyerNote('12,')).toBe('12,')
    expect(nettoyerNote('')).toBe('')
  })
  it('limite la partie entière à trois chiffres', () => {
    expect(nettoyerNote('12345')).toBe('123')
  })
})

describe('lireNote', () => {
  it('lit la virgule comme un point', () => {
    expect(lireNote('12,5')).toBe(12.5)
    expect(lireNote(' 7 ')).toBe(7)
    expect(lireNote(18)).toBe(18)
  })
  it('renvoie null pour vide ou non numérique', () => {
    expect(lireNote('')).toBeNull()
    expect(lireNote(null)).toBeNull()
    expect(lireNote(',')).toBeNull()
    expect(lireNote('abc')).toBeNull()
  })
})

describe('enPourcentage', () => {
  it('calcule une note décimale', () => {
    expect(enPourcentage('15,0', 30)).toBe(50)
  })
  it('exclut une note au-dessus du barème ou négative', () => {
    expect(enPourcentage('32', 30)).toBeNull()
    expect(enPourcentage('125', 30)).toBeNull()
    expect(enPourcentage('-1', 30)).toBeNull()
  })
})

describe('note invalide', () => {
  const p = { entreeBrut: '15', sortieTheoBrut: '32', sortiePratBrut: '16' }
  it('n’entre ni dans la progression ni dans le score', () => {
    const c = calculer(p)
    expect(c.sortieTheorique).toBeNull()
    expect(c.progression).toBeNull()
    expect(c.scoreFinal).toBe(80)
    expect(c.complet).toBe(false)
  })
  it('reste signalée en erreur', () => {
    expect(anomalies(p)).toEqual([
      expect.objectContaining({ champ: 'sortieTheoBrut', niveau: 'erreur' }),
    ])
  })
  it('signale une valeur non numérique', () => {
    expect(anomalies({ entreeBrut: ',' })[0].message).toMatch(/non numérique/)
  })
})

describe('syntheseGroupe', () => {
  it('applique le barème modifié', () => {
    const participants = [{ entreeBrut: '10', sortieTheoBrut: '20', sortiePratBrut: '20' }]
    const baremes = { entreeTheorique: 20, sortieTheorique: 20, sortiePratique: 20 }
    expect(syntheseGroupe(participants).scoreFinal).toBeCloseTo(83.3, 1)
    expect(syntheseGroupe(participants, baremes).scoreFinal).toBe(100)
  })
})
