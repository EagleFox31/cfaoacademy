import { describe, expect, it } from 'vitest'
import {
  BAREMES, anomalies, calculer, enPourcentage, normaliserNote, syntheseGroupe,
} from './baremeCfao'

const p = (entreeBrut, sortieTheoBrut, sortiePratBrut, extra = {}) =>
  ({ entreeBrut, sortieTheoBrut, sortiePratBrut, ...extra })

describe('calculer', () => {
  it('reprend les formules du classeur (30/30/20, progression relative)', () => {
    const c = calculer(p('15', '22.5', '16'))
    expect(c.entree).toBe(50)
    expect(c.sortieTheorique).toBe(75)
    expect(c.sortiePratique).toBe(80)
    expect(c.progression).toBe(50) // (75 - 50) / 50, pas 25 points
    expect(c.scoreFinal).toBe(77.5) // moyenne des sorties, l'entree ignoree
    expect(c.valide).toBe(true)
    expect(c.complet).toBe(true)
    expect(c.partielle).toBe(false)
  })

  it('applique le seuil de 70 a la limite', () => {
    expect(calculer(p('', '21', '14')).valide).toBe(true)
    expect(calculer(p('', '20.9', '14')).valide).toBe(false)
  })

  it('distingue le vide du zero', () => {
    expect(calculer(p('', '', '')).scoreFinal).toBeNull()
    expect(calculer(p('0', '0', '0')).scoreFinal).toBe(0)
  })

  it('ne calcule pas de progression sur une entree a zero', () => {
    expect(calculer(p('0', '30', '20')).progression).toBeNull()
  })

  it('signale une note finale tiree d une seule sortie', () => {
    const c = calculer(p('15', '24', ''))
    expect(c.scoreFinal).toBe(80)
    expect(c.partielle).toBe(true)
    expect(c.complet).toBe(false)
  })

  it('suit un bareme modifie', () => {
    const c = calculer(p('', '15', '20'), { ...BAREMES, sortieTheorique: 20, sortiePratique: 40 })
    expect(c.sortieTheorique).toBe(75)
    expect(c.sortiePratique).toBe(50)
  })
})

describe('syntheseGroupe', () => {
  const groupe = [p('15', '24', '18'), p('15', '15', ''), p('', '', '', { present: false })]

  it('compte les presents, les partielles et le retrait', () => {
    const s = syntheseGroupe(groupe)
    expect(s.effectif).toBe(2)
    expect(s.saisis).toBe(2)
    expect(s.partielles).toBe(1)
    expect(s.enRetrait).toBe(1) // 50 % sous le seuil
    expect(s.scoreFinal).toBe(67.5) // (85 + 50) / 2
    expect(s.complet).toBe(false)
  })

  it('applique le bareme du brouillon', () => {
    const bareme = { ...BAREMES, sortiePratique: 40 }
    expect(syntheseGroupe([p('', '30', '20')], bareme).scoreFinal).toBe(75)
    expect(syntheseGroupe([p('', '30', '20')]).scoreFinal).toBe(100)
  })
})

describe('normaliserNote', () => {
  it('accepte la virgule et le point, une decimale', () => {
    expect(normaliserNote('12,5', 30)).toBe('12.5')
    expect(normaliserNote('12.55', 30)).toBe('12.5')
    expect(normaliserNote('12,', 30)).toBe('12.')
    expect(normaliserNote(',5', 30)).toBe('0.5')
  })

  it('plafonne au bareme et filtre le reste', () => {
    expect(normaliserNote('32', 30)).toBe('30')
    expect(normaliserNote('20,5', 20)).toBe('20')
    expect(normaliserNote('1a2', 30)).toBe('12')
    expect(normaliserNote('', 30)).toBe('')
    expect(normaliserNote('-3', 30)).toBe('3')
  })

  it('donne une note que le calcul lit', () => {
    expect(enPourcentage(normaliserNote('7,5', 30), 30)).toBe(25)
  })
})

describe('anomalies', () => {
  it('signale le depassement et la regression sans bloquer', () => {
    expect(anomalies(p('', '31', '')).map(a => a.niveau)).toEqual(['erreur'])
    expect(anomalies(p('20', '10', '')).map(a => a.niveau)).toEqual(['avertissement'])
    expect(anomalies(p('10', '20', '15'))).toEqual([])
  })
})
