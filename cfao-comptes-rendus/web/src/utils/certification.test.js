import { describe, expect, it } from 'vitest'
import {
  CERTIFIE, ECHOUE, NON_CERTIFIE, NON_FINALISE, VALIDE, calculerCertification, niveauDe,
} from './certification'

const modules = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
const candidat = (notes, elearning = {}) => ({
  notesModules: Object.fromEntries(notes.map((n, i) => [`m${i + 1}`, n])),
  elearning,
})

describe('calculerCertification', () => {
  it('ne donne aucun pourcentage tant qu’une note manque', () => {
    const c = calculerCertification(candidat([80, '', 90]), modules)
    expect(c.complet).toBe(false)
    expect(c.pourcentage).toBeNull()
    expect(c.pratique).toBeNull()
    expect(c.final).toBeNull()
  })

  it('valide la pratique a 70 % et totalise sur 100 par module', () => {
    const c = calculerCertification(candidat([70, 70, 70]), modules)
    expect(c.total).toBe(210)
    expect(c.max).toBe(300)
    expect(c.pourcentage).toBe(70)
    expect(c.pratique).toBe(VALIDE)
  })

  it('accepte la virgule decimale des classeurs', () => {
    const c = calculerCertification(candidat(['69,5', 70, 70]), modules)
    expect(c.notes[0]).toBe(69.5)
  })

  it('conclut NON CERTIFIÉ des qu’une pratique est echouee', () => {
    const c = calculerCertification(candidat([10, 20, 30], { statut: VALIDE }), modules)
    expect(c.pratique).toBe(ECHOUE)
    expect(c.final).toBe(NON_CERTIFIE)
  })

  it('attend le statut e-learning pour certifier', () => {
    expect(calculerCertification(candidat([90, 90, 90]), modules).final).toBeNull()
    expect(calculerCertification(candidat([90, 90, 90], { statut: VALIDE }), modules).final)
      .toBe(CERTIFIE)
    expect(calculerCertification(candidat([90, 90, 90], { statut: NON_FINALISE }), modules).final)
      .toBe(NON_CERTIFIE)
  })

  it('calcule le taux de participation e-learning', () => {
    const c = calculerCertification(candidat([90, 90, 90], { requis: 136, valides: 112 }), modules)
    expect(c.elearning.taux).toBe(82)
  })
})

describe('niveauDe', () => {
  it('lit le niveau dans le suffixe du code', () => {
    expect(niveauDe({ codeFormation: 'XX99-g2' })).toBe('G2')
    expect(niveauDe({ codeFormation: '' })).toBe('')
  })
})

describe('seuil de validation', () => {
  it('suit le seuil passe, 70 % sans seuil', () => {
    expect(calculerCertification(candidat([75, 75, 75]), modules).pratique).toBe(VALIDE)
    expect(calculerCertification(candidat([75, 75, 75]), modules, 80).pratique).toBe(ECHOUE)
    expect(calculerCertification(candidat([75, 75, 75]), modules, 75).pratique).toBe(VALIDE)
  })
})
