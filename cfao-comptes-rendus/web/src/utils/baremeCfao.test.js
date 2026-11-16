import { describe, it, expect } from 'vitest'
import {
  lireNote, nettoyerNote, enPourcentage, calculer, syntheseGroupe, anomalies, seuilDe, SEUIL_DEFAUT,
  reglesAuSeuil,
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
    expect(c.scoreFinal).toBeNull()
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

describe('seuil de validation du compte rendu', () => {
  it('seuilDe : 70 par defaut, valeur du brouillon sinon', () => {
    expect(SEUIL_DEFAUT).toBe(70)
    expect(seuilDe({})).toBe(70)
    expect(seuilDe(undefined)).toBe(70)
    expect(seuilDe({ seuil: '' })).toBe(70)
    expect(seuilDe({ seuil: 0 })).toBe(70)
    expect(seuilDe({ seuil: 150 })).toBe(70)
    expect(seuilDe({ seuil: '80' })).toBe(80)
    expect(seuilDe({ seuil: 65 })).toBe(65)
  })

  const sur100 = { entreeTheorique: 100, sortieTheorique: 100, sortiePratique: 100 }
  const p = { entreeBrut: '', sortieTheoBrut: '75', sortiePratBrut: '75' }

  it('calculer : valide a 70 par defaut, refuse 75 avec un seuil de 80', () => {
    expect(calculer(p, sur100).valide).toBe(true)
    expect(calculer(p, sur100, 80).valide).toBe(false)
    expect(calculer(p, sur100, 75).valide).toBe(true)
  })

  it('syntheseGroupe : le nombre en retrait suit le seuil', () => {
    const groupe = [p, { ...p, sortieTheoBrut: '90', sortiePratBrut: '90' }]
    expect(syntheseGroupe(groupe, sur100).enRetrait).toBe(0)
    expect(syntheseGroupe(groupe, sur100, 80).enRetrait).toBe(1)
    expect(syntheseGroupe(groupe, sur100, 95).enRetrait).toBe(2)
  })
})

describe('corrections de la revue L0', () => {
  it('une note de sortie hors barème bloque le score final', () => {
    const c = calculer({ sortieTheoBrut: "24", sortiePratBrut: "25" }, undefined, 70)
    expect(c.scoreFinal).toBeNull()
    expect(c.valide).toBeNull()
  })

  it('les règles du modèle suivent le seuil', () => {
    const r = reglesAuSeuil([
      { type: 'cellIs', operator: 'between', formulae: ['70%', '100%'] },
      { type: 'cellIs', operator: 'between', formulae: ['0%', '69.99%'] },
      { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: ['0.7'] },
      { type: 'cellIs', operator: 'between', formulae: ['0.001', '0.699'] },
    ], 80)
    expect(r.map(x => x.formulae)).toEqual([['80%', '100%'], ['0%', '79.99%'], ['0.8'], ['0.001', '0.799']])
  })
})
