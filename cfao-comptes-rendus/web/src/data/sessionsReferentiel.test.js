import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adresseSessions, chargerEtat, chargerSession, chargerSessions, choisirSource,
  ErreurSessions, SOURCE_API, SOURCE_ESSAI,
} from './sessionsReferentiel'

// Un service qui repond selon l'adresse demandee ; `appels` garde les adresses.
let appels
function service(routes) {
  appels = []
  vi.stubGlobal('fetch', async url => {
    appels.push(url)
    const cle = Object.keys(routes).find(c => url.includes(c))
    if (!cle) throw new Error('muet')
    const { status = 200, json = {} } = routes[cle]
    return { ok: status >= 200 && status < 300, status, json: async () => json }
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('choisirSource', () => {
  it('referentiel renseigne : l\'API', () => {
    expect(choisirSource({ vide: false })).toBe(SOURCE_API)
  })
  it('referentiel vide ou service muet : le mode d\'essai', () => {
    expect(choisirSource({ vide: true })).toBe(SOURCE_ESSAI)
    expect(choisirSource(null)).toBe(SOURCE_ESSAI)
    expect(choisirSource({})).toBe(SOURCE_ESSAI)
  })
})

describe('adresseSessions', () => {
  it('sans filtre, l\'adresse nue', () => {
    expect(adresseSessions()).toMatch(/\/cr-donnees\/sessions$/)
    expect(adresseSessions({ q: '  ', mois: '' })).toMatch(/\/cr-donnees\/sessions$/)
  })
  it('seuls les filtres renseignes partent', () => {
    const u = adresseSessions({ q: 'SAV 01', mois: '2026-03', pays: '', marque: 'Toyota' })
    expect(u).toContain('/cr-donnees/sessions?')
    const p = new URLSearchParams(u.split('?')[1])
    expect(Object.fromEntries(p)).toEqual({ q: 'SAV 01', mois: '2026-03', marque: 'Toyota' })
  })
})

describe('chargerEtat', () => {
  it('lit l\'etat du referentiel', async () => {
    service({ '/referentiel/etat': { json: { vide: false } } })
    expect(await chargerEtat()).toEqual({ vide: false })
  })
  it('service muet, refus ou reponse illisible : null', async () => {
    service({})
    expect(await chargerEtat()).toBeNull()
    service({ '/referentiel/etat': { status: 500 } })
    expect(await chargerEtat()).toBeNull()
    service({ '/referentiel/etat': { json: { autre: 1 } } })
    expect(await chargerEtat()).toBeNull()
  })
})

describe('chargerSessions', () => {
  const user = { firstName: 'Jean', lastName: 'Test', roles: ['formateur'] }

  it('referentiel renseigne : les sessions de l\'API, filtrees par le service', async () => {
    service({
      '/referentiel/etat': { json: { vide: false } },
      '/cr-donnees/sessions': { json: { sessions: [{ id: '12', codeSession: 'S-12' }] } },
    })
    const r = await chargerSessions({ q: 'S-12' }, user)
    expect(r).toEqual({ source: SOURCE_API, sessions: [{ id: '12', codeSession: 'S-12' }] })
    expect(appels.some(a => a.includes('/cr-donnees/sessions?q=S-12'))).toBe(true)
  })

  it('referentiel vide : les sessions d\'essai, sans appeler la liste', async () => {
    service({ '/referentiel/etat': { json: { vide: true } } })
    const r = await chargerSessions({ q: 'x' }, user)
    expect(r.source).toBe(SOURCE_ESSAI)
    expect(Array.isArray(r.sessions)).toBe(true)
    expect(appels.every(a => a.includes('/referentiel/etat'))).toBe(true)
  })

  it('service muet : le mode d\'essai', async () => {
    service({})
    expect((await chargerSessions({}, user)).source).toBe(SOURCE_ESSAI)
  })

  it('panne apres un referentiel renseigne : erreur lisible, pas de repli sur les essais', async () => {
    service({
      '/referentiel/etat': { json: { vide: false } },
      '/cr-donnees/sessions': { status: 500 },
    })
    const erreur = await chargerSessions({}, user).catch(e => e)
    expect(erreur).toBeInstanceOf(ErreurSessions)
    expect(erreur.statut).toBe(500)
    expect(erreur.message).toMatch(/ne répond pas/)
  })

  it('403 : message dedie', async () => {
    service({
      '/referentiel/etat': { json: { vide: false } },
      '/cr-donnees/sessions': { status: 403 },
    })
    const erreur = await chargerSessions({}, user).catch(e => e)
    expect(erreur.statut).toBe(403)
    expect(erreur.message).toMatch(/accès/)
  })
})

describe('chargerSession', () => {
  it('une session par son identifiant', async () => {
    service({ '/cr-donnees/sessions/7': { json: { id: '7' } } })
    expect(await chargerSession(7)).toEqual({ id: '7' })
  })
  it('inconnue : null', async () => {
    service({ '/cr-donnees/sessions/8': { status: 404 } })
    expect(await chargerSession(8)).toBeNull()
  })
})
