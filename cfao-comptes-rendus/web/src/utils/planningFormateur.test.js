import { describe, expect, it } from 'vitest'
import { aDocumenter, sessionsARediger, sessionsAVenir } from './planningFormateur.js'

const JOUR = '2026-09-30'
const s = (id, statut, fin) => ({ id, statut, fin })
const SESSIONS = [
  s('redige', 'a_rediger', '2026-08-21'),
  s('passee', 'en_cours', '2026-09-11'),   // planning pas a jour : la date fait foi
  s('bientot', 'a_venir', '2026-10-09'),
  s('close', 'termine', '2026-09-04'),
]

describe('planning du formateur', () => {
  it('une session passee est a documenter, meme si le planning la dit en cours', () => {
    expect(sessionsARediger(SESSIONS, JOUR).map(x => x.id)).toEqual(['redige', 'passee'])
  })

  it('les sessions a venir excluent celles deja passees', () => {
    expect(sessionsAVenir(SESSIONS, JOUR).map(x => x.id)).toEqual(['bientot'])
  })

  it('une session commencee se continue, elle ne se recommence pas', () => {
    const brouillons = [{ id: 'passee', termine: false }, { id: 'manuel-1', termine: false }]
    const { aContinuer, aCommencer } = aDocumenter(SESSIONS, brouillons, JOUR)
    expect(aContinuer.map(b => b.id)).toEqual(['passee', 'manuel-1'])
    expect(aCommencer.map(x => x.id)).toEqual(['redige'])
  })

  it('un compte rendu termine sort des deux listes', () => {
    const { aContinuer, aCommencer } = aDocumenter(SESSIONS, [{ id: 'redige', termine: true }], JOUR)
    expect(aContinuer).toEqual([])
    expect(aCommencer.map(x => x.id)).toEqual(['passee'])
  })
})
