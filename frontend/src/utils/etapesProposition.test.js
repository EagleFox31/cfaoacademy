import { describe, expect, it } from 'vitest'
import fr from '../i18n/locales/fr/portal.json'
import { STATUTS, aUnChangement, cleChangement, dateCourte, estTerminee, libelleEtape, statutDe } from './etapesProposition.js'

describe('étapes d’une proposition', () => {
  it('ordre du choix : Envoyée, Lue, Planifiée, En ligne, Non retenue', () => {
    expect(STATUTS).toEqual(['nouvelle', 'lue', 'planifiee', 'en_ligne', 'non_retenue'])
    STATUTS.forEach(s => expect(fr[`proposition_etape_${s}`]).toBeTruthy())
  })

  it('statut inconnu (ancienne donnée) : vaut Envoyée, sans changement à signaler', () => {
    expect(statutDe({ statut: 'traitee' })).toBe('nouvelle')
    expect(aUnChangement({ statut: 'traitee' })).toBe(false)
    expect(aUnChangement({ statut: 'lue' })).toBe(true)
  })

  it('terminée : en ligne ou non retenue', () => {
    expect(['nouvelle', 'lue', 'planifiee', 'en_ligne', 'non_retenue'].map(statut => estTerminee({ statut })))
      .toEqual([false, false, false, true, true])
  })

  it('clé de changement : une nouvelle date de passage donne une nouvelle clé', () => {
    const p = { id: 'a', statut: 'planifiee', etape_le: '2026-11-23T09:00:00Z' }
    expect(cleChangement(p)).not.toBe(cleChangement({ ...p, etape_le: '2026-11-24T09:00:00Z' }))
    expect(cleChangement(p)).not.toBe(cleChangement({ ...p, statut: 'en_ligne' }))
  })

  it('Planifiée : libellé avec la date prévue, qui reste ce jour-là', () => {
    expect(libelleEtape({ statut: 'planifiee', echeance: '2026-12-15' }, fr, 'fr'))
      .toBe(`${fr.proposition_etape_planifiee} · Prévue d’ici le 15 déc. 2026`)
    expect(libelleEtape({ statut: 'lue' }, fr, 'fr')).toBe(fr.proposition_etape_lue)
  })

  it('date illisible ou absente : rien', () => {
    expect(dateCourte('', 'fr')).toBe('')
    expect(dateCourte('pas une date', 'fr')).toBe('')
  })
})
