import { describe, expect, it } from 'vitest'
import {
  filtresActifs, filtreFormateurVisible, formateurPur, formateursDe, fusionnerOptions, OPTIONS_VIDES,
} from './filtresSessions'

describe('formateurPur', () => {
  it('sans role ou seulement formateur', () => {
    expect(formateurPur(null)).toBe(true)
    expect(formateurPur({})).toBe(true)
    expect(formateurPur({ roles: [] })).toBe(true)
    expect(formateurPur({ roles: ['formateur'] })).toBe(true)
  })
  it('tout autre role sort du cas', () => {
    expect(formateurPur({ roles: ['formateur', 'superadmin'] })).toBe(false)
    expect(formateurPur({ roles: ['responsable'] })).toBe(false)
  })
})

describe('filtreFormateurVisible', () => {
  it('toujours visible pour qui n\'est pas formateur pur', () => {
    expect(filtreFormateurVisible({ roles: ['superadmin'] }, [])).toBe(true)
  })
  it('formateur pur : seulement si la liste compte plusieurs formateurs', () => {
    const u = { roles: ['formateur'] }
    expect(filtreFormateurVisible(u, [])).toBe(false)
    expect(filtreFormateurVisible(u, ['Jean Test'])).toBe(false)
    expect(filtreFormateurVisible(u, ['Jean Test', 'Awa Bello'])).toBe(true)
  })
})

describe('formateursDe', () => {
  it('liste les formateurs une fois chacun, via `formateurs` ou le texte `formateur`', () => {
    const noms = formateursDe([
      { formateurs: [{ nom: 'Jean Test', id: 1 }, { nom: 'Awa Bello', id: 2 }] },
      { formateur: 'Jean Test' },
      { formateur: '' },
    ])
    expect([...noms].sort()).toEqual(['Awa Bello', 'Jean Test'])
  })
})

describe('fusionnerOptions', () => {
  it('cumule les valeurs sans doublon, pour que les choix ne disparaissent pas', () => {
    const premier = fusionnerOptions(OPTIONS_VIDES, [
      { paysHote: 'Cameroun', marque: 'Toyota', formateur: 'Jean Test' },
      { paysHote: 'Tchad', marque: 'Toyota', formateur: 'Awa Bello' },
    ])
    expect([...premier.pays].sort()).toEqual(['Cameroun', 'Tchad'])
    expect(premier.marques).toEqual(['Toyota'])
    const filtree = fusionnerOptions(premier, [{ paysHote: 'Tchad', marque: 'Toyota', formateur: 'Awa Bello' }])
    expect([...filtree.pays].sort()).toEqual(['Cameroun', 'Tchad'])
    expect(filtree.formateurs).toHaveLength(2)
  })
})

describe('filtresActifs', () => {
  it('vrai des qu\'un filtre est renseigne', () => {
    expect(filtresActifs({ q: '', mois: '', pays: '', marque: '', formateur: '' })).toBe(false)
    expect(filtresActifs({ q: '  ', mois: '' })).toBe(false)
    expect(filtresActifs({ q: '', pays: 'Tchad' })).toBe(true)
  })
})
