import { beforeEach, describe, expect, it } from 'vitest'
import { choixRetenu, formateurInitial, nouveautes, oublierChoix, retenir } from './formateurParDefaut'

const session = { formateur: 'Jean TEST' }

function stockage() {
  const m = new Map()
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    clear: () => m.clear(),
  }
}
globalThis.localStorage = stockage()
globalThis.sessionStorage = stockage()

beforeEach(() => {
  localStorage.clear()
  sessionStorage.setItem('cfao_mock_user', JSON.stringify({ id: 'test-formateur' }))
})

describe('formateurParDefaut', () => {
  it('part de la session tant que rien n’est retenu', () => {
    expect(formateurInitial(session)).toEqual({ nom: 'Jean TEST', fonction: 'Formateur', portrait: null })
    expect(choixRetenu()).toBeNull()
  })

  it('ne signale que les champs qui changent le défaut', () => {
    const f = { nom: 'Jean TEST', fonction: 'Expert moteur', portrait: { ref: 'p1' } }
    expect(nouveautes(f, session)).toEqual({ fonction: 'Expert moteur', portrait: { ref: 'p1' } })
    expect(nouveautes({ nom: 'Jean TEST', fonction: 'Formateur' }, session)).toEqual({})
  })

  it('ignore un portrait resté local', () => {
    expect(nouveautes({ portrait: { apercu: 'blob:x' } }, session)).toEqual({})
  })

  it('retient les nouveautés et le choix, par utilisateur', () => {
    retenir({ nom: 'Jean TEST MARTIN', portrait: { ref: 'p1' } }, 'toujours')
    expect(formateurInitial(session)).toEqual({ nom: 'Jean TEST MARTIN', fonction: 'Formateur', portrait: { ref: 'p1' } })
    expect(choixRetenu()).toBe('toujours')
    expect(nouveautes({ nom: 'Jean TEST MARTIN' }, session)).toEqual({})

    sessionStorage.setItem('cfao_mock_user', JSON.stringify({ id: 'autre' }))
    expect(formateurInitial(session).nom).toBe('Jean TEST')
  })

  it('« jamais » ne change pas le défaut', () => {
    retenir({}, 'jamais')
    expect(choixRetenu()).toBe('jamais')
    expect(formateurInitial(session).fonction).toBe('Formateur')
  })

  it('oublier le choix fait revenir la proposition sans perdre le défaut', () => {
    retenir({ fonction: 'Expert technique' }, 'toujours')
    oublierChoix()
    expect(choixRetenu()).toBe(null)
    expect(formateurInitial(session).fonction).toBe('Expert technique')
  })
})
