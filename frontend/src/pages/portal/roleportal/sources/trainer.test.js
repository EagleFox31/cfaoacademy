import { describe, expect, it } from 'vitest'
import { marquesDuFormateur } from '../../../../utils/catalogFormateur.js'
import { etatSessions, sessionDuPlanning } from './trainer.js'

describe('sessions du formateur lues dans le planning', () => {
  const api = {
    id: 's1', code: 'TS01', title: '', brand: 'Toyota', brand_code: 'toyota', pole: 'EQUIPMENT',
    start_date: '2027-03-01', end_date: '2027-03-05', country_label: 'Cameroun', location: '',
  }

  it('reprend le format des cartes, lieu et titre de repli compris', () => {
    expect(sessionDuPlanning(api, '2027-02-20')).toEqual({
      id: 's1', moduleFormation: 'TS01', marque: 'Toyota', pole: 'Equipment',
      debut: '2027-03-01', fin: '2027-03-05', lieu: 'Cameroun', statut: 'a_venir', participants: null,
    })
    expect(sessionDuPlanning(api, '2027-03-05').statut).toBe('en_cours')
    expect(sessionDuPlanning({ ...api, end_date: null }, '2027-03-01').fin).toBe('2027-03-01')
  })

  it('distingue chargement, erreur, compte non relié et liste prête', () => {
    expect(etatSessions(null, null).etat).toBe('loading')
    expect(etatSessions(null, new Error('x')).etat).toBe('error')
    expect(etatSessions({ linked: false, sessions: [] }, null).etat).toBe('unlinked')
    const pret = etatSessions({ linked: true, sessions: [api] }, null)
    expect(pret.etat).toBe('ready')
    expect(pret.sessions.map(s => s.id)).toEqual(['s1'])
  })
})

describe('marques du formateur', () => {
  it('lit ses marques dans l’équipe des pôles, accents et casse ignorés', () => {
    expect(marquesDuFormateur('Eugène EBENE')).toEqual(['toyota'])
    expect(marquesDuFormateur('eugene ebene')).toEqual(['toyota'])
    expect(marquesDuFormateur('Jacques MAVILA')).toEqual(['toyota', 'suzuki'])
    expect(marquesDuFormateur('Inconnu')).toEqual([])
    expect(marquesDuFormateur('')).toEqual([])
  })
})
