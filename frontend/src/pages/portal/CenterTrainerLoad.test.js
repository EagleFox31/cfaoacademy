// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { choisirAnnee, pastilleRythme } from './CenterTrainerLoad.jsx'
import fr from '../../i18n/locales/fr/centerHome.json'

const formateur = (sessions_count, close_sessions = 0) => ({ sessions_count, close_sessions })
const annee = (year, trainers, unassigned_sessions = 0) => ({ year, trainers, unassigned_sessions })

describe('choisirAnnee', () => {
  it('retient la plus récente année où des formateurs sont affectés', () => {
    const choix = choisirAnnee([annee(2027, [formateur(0)], 33), annee(2026, [formateur(4)])])
    expect(choix.charge.year).toBe(2026)
    expect(choix.enAttente).toEqual([{ annee: 2027, sessions: 33 }])
  })

  it('signale aussi les sessions sans formateur de l’année retenue', () => {
    const choix = choisirAnnee([annee(2027, [formateur(2)], 5)])
    expect(choix.charge.year).toBe(2027)
    expect(choix.enAttente).toEqual([{ annee: 2027, sessions: 5 }])
  })

  it('sans affectation nulle part, garde l’année la plus récente', () => {
    expect(choisirAnnee([annee(2027, [formateur(0)], 3), null]).charge.year).toBe(2027)
    expect(choisirAnnee([null])).toBeNull()
  })
})

describe('pastilleRythme', () => {
  it('distingue rythme tenu, sessions rapprochées et aucune session', () => {
    expect(pastilleRythme(formateur(3), fr)).toEqual({ chip: 'done', texte: 'Rythme tenu' })
    expect(pastilleRythme(formateur(3, 2), fr)).toEqual({ chip: 'progress', texte: '2 sessions rapprochées' })
    expect(pastilleRythme(formateur(0), fr)).toEqual({ chip: 'todo', texte: 'Aucune session' })
  })
})
