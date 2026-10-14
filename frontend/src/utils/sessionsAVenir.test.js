import { describe, expect, it } from 'vitest'
import { sessionsAVenir } from './sessionsAVenir.js'

const JOUR = '2026-09-30'
const s = (id, statut, fin) => ({ id, statut, fin })
const SESSIONS = [
  s('redige', 'a_rediger', '2026-08-21'),
  s('passee', 'en_cours', '2026-09-11'),   // planning pas a jour : la date fait foi
  s('bientot', 'a_venir', '2026-10-09'),
  s('close', 'termine', '2026-09-04'),
]

describe('sessions a venir du formateur', () => {
  it('exclut les sessions deja passees, meme dites en cours par le planning', () => {
    expect(sessionsAVenir(SESSIONS, JOUR).map(x => x.id)).toEqual(['bientot'])
  })
})
