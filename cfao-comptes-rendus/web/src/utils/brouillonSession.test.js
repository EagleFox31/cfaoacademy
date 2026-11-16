import { describe, expect, it } from 'vitest'
import {
  brouillonVide, depuisSession, estSessionReferentiel, identiteVerrouillee, sessionDepuisBrouillon,
} from './brouillonSession'

const SESSION_API = {
  id: '42',
  codeSession: 'SES-042',
  codeFormation: 'SAV-01',
  moduleFormation: 'Diagnostic moteur',
  marque: 'Toyota',
  paysHote: 'Cameroun',
  lieu: 'Douala',
  debut: '2026-03-02',
  fin: '2026-03-04',
  formateur: 'Jean Test',
  seuil: 70,
  participants: [
    { id: 'p1', nom: 'Abena', prenom: 'Luc', pays: 'Cameroun', absent: false },
    { id: 'p2', nom: 'Bello', prenom: 'Awa', pays: 'Tchad', absent: true },
  ],
}

describe('estSessionReferentiel / identiteVerrouillee', () => {
  it('seul un identifiant numerique designe le referentiel', () => {
    expect(estSessionReferentiel('42')).toBe(true)
    expect(estSessionReferentiel(42)).toBe(true)
    expect(estSessionReferentiel('ses-1')).toBe(false)
    expect(estSessionReferentiel('manuel-abc')).toBe(false)
    expect(estSessionReferentiel(null)).toBe(false)
  })

  it('identite en lecture seule pour une session numerique, libre sinon', () => {
    expect(identiteVerrouillee({ sessionId: '42' })).toBe(true)
    expect(identiteVerrouillee({ sessionId: 'ses-1' })).toBe(false)
    expect(identiteVerrouillee({ sessionId: 'manuel-1', manuel: true })).toBe(false)
    expect(identiteVerrouillee({ sessionId: '42', manuel: true })).toBe(false)
    expect(identiteVerrouillee(brouillonVide())).toBe(false)
  })
})

describe('depuisSession (referentiel)', () => {
  const b = depuisSession(SESSION_API)

  it('recopie l\'identite de la session', () => {
    expect(b).toMatchObject({
      sessionId: '42', intitule: 'Diagnostic moteur', codeFormation: 'SAV-01', marque: 'Toyota',
      lieu: 'Douala', pays: 'Cameroun', debut: '2026-03-02', fin: '2026-03-04', seuil: 70,
    })
    expect(typeof b.sessionId).toBe('string')
    expect(b.manuel).toBe(false)
  })

  it('reprend les stagiaires de l\'API : id conserve, present = non absent, saisie vide', () => {
    const vide = { entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '', appreciation: '' }
    expect(b.participants).toEqual([
      { id: 'p1', nom: 'Abena', prenom: 'Luc', pays: 'Cameroun', present: true, ...vide },
      { id: 'p2', nom: 'Bello', prenom: 'Awa', pays: 'Tchad', present: false, ...vide },
    ])
  })

  it('le brouillon obtenu est verrouille', () => {
    expect(identiteVerrouillee(b)).toBe(true)
  })
})

describe('depuisSession (essai)', () => {
  it('sans seuil et sans verrou pour une session d\'essai', () => {
    const b = depuisSession({
      ...SESSION_API, id: 'ses-1', seuil: undefined,
      participants: [{ id: 'x', nom: 'N', prenom: 'P', pays: 'Gabon', present: true }],
    })
    expect(b.sessionId).toBe('ses-1')
    expect('seuil' in b).toBe(false)
    expect(b.participants[0]).toMatchObject({ nom: 'N', present: true, entreeBrut: '' })
    expect(identiteVerrouillee(b)).toBe(false)
  })
})

describe('sessionDepuisBrouillon', () => {
  it('rebatit la session a partir du brouillon et complete avec la session connue', () => {
    const b = depuisSession(SESSION_API)
    const s = sessionDepuisBrouillon(b, { codeSession: 'SES-042', formateur: 'Jean Test' })
    expect(s).toMatchObject({
      codeSession: 'SES-042', formateur: 'Jean Test', moduleFormation: 'Diagnostic moteur',
      codeFormation: 'SAV-01', marque: 'Toyota', lieu: 'Douala', paysHote: 'Cameroun',
      debut: '2026-03-02', fin: '2026-03-04',
    })
  })
  it('sans session connue, le brouillon seul suffit', () => {
    const s = sessionDepuisBrouillon({ intitule: 'X', codeFormation: 'C', marque: 'M', lieu: 'L', pays: 'P', debut: 'd', fin: 'f' })
    expect(s.moduleFormation).toBe('X')
    expect(s.paysHote).toBe('P')
  })
})
