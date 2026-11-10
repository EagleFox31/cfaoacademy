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
  it('service absent (404) ou reponse qui n\'est pas l\'etat : null', async () => {
    service({ '/referentiel/etat': { status: 404 } })
    expect(await chargerEtat()).toBeNull()
    service({ '/referentiel/etat': { json: { autre: 1 } } })
    expect(await chargerEtat()).toBeNull()
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => { throw new Error('html') } }))
    expect(await chargerEtat()).toBeNull()
  })
  it.each([401, 403, 500, 502, 503])('statut %i : erreur lisible, pas le mode d\'essai', async statut => {
    service({ '/referentiel/etat': { status: statut } })
    const erreur = await chargerEtat().catch(e => e)
    expect(erreur).toBeInstanceOf(ErreurSessions)
    expect(erreur.statut).toBe(statut)
  })
  it('reseau coupe ou delai depasse : erreur de statut 0', async () => {
    service({})
    const coupe = await chargerEtat().catch(e => e)
    expect(coupe).toBeInstanceOf(ErreurSessions)
    expect(coupe.statut).toBe(0)
    vi.stubGlobal('fetch', (url, { signal }) => new Promise((_, rejet) => {
      signal.addEventListener('abort', () => rejet(new DOMException('abort', 'AbortError')))
    }))
    vi.useFakeTimers()
    const attente = chargerEtat().catch(e => e)
    await vi.advanceTimersByTimeAsync(8100)
    const delai = await attente
    vi.useRealTimers()
    expect(delai).toBeInstanceOf(ErreurSessions)
    expect(delai.statut).toBe(0)
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

  it('service absent (404) : le mode d\'essai', async () => {
    service({ '/referentiel/etat': { status: 404 } })
    expect((await chargerSessions({}, user)).source).toBe(SOURCE_ESSAI)
  })

  it.each([401, 403, 500])('etat refuse ou en panne (%i) : erreur, jamais les sessions d\'essai', async statut => {
    service({ '/referentiel/etat': { status: statut } })
    const erreur = await chargerSessions({}, user).catch(e => e)
    expect(erreur).toBeInstanceOf(ErreurSessions)
    expect(erreur.statut).toBe(statut)
    expect(appels.every(a => a.includes('/referentiel/etat'))).toBe(true)
  })

  it('reseau coupe : erreur lisible, jamais les sessions d\'essai', async () => {
    service({})
    const erreur = await chargerSessions({}, user).catch(e => e)
    expect(erreur).toBeInstanceOf(ErreurSessions)
    expect(erreur.statut).toBe(0)
    expect(erreur.message).toMatch(/ne répond pas/)
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
