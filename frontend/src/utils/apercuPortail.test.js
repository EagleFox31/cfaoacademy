// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLE_APERCU,
  ROLES_APERCU,
  lireApercu,
  ouvrirApercu,
  peutOuvrirApercu,
  quitterApercu,
  urlApercu,
  utilisateurApercu,
  verrouillerEcritures,
} from './apercuPortail.js'

const ici = (search = '') => ({ search })

beforeEach(() => sessionStorage.clear())

describe('rôles proposés', () => {
  it('un portail par rôle, sans le super admin ni l’équipe build, apprenant compris', () => {
    expect(ROLES_APERCU).not.toContain('superadmin')
    expect(ROLES_APERCU).not.toContain('build_team')
    expect(ROLES_APERCU).toEqual(expect.arrayContaining(['training_coordinator', 'trainer', 'dps', 'learner']))
    expect(new Set(ROLES_APERCU).size).toBe(ROLES_APERCU.length)
  })

  it('seul le super admin ouvre un aperçu', () => {
    expect(peutOuvrirApercu(['superadmin'])).toBe(true)
    expect(peutOuvrirApercu(['build_team'])).toBe(false)
    expect(peutOuvrirApercu(['group_admin'])).toBe(false)
    expect(peutOuvrirApercu(undefined)).toBe(false)
  })
})

describe('rôle de la fenêtre', () => {
  it('retient le rôle demandé dans l’adresse, pour la suite de la navigation', () => {
    expect(lireApercu(ici('?apercu=trainer'))).toBe('trainer')
    expect(sessionStorage.getItem(CLE_APERCU)).toBe('trainer')
    expect(lireApercu(ici(''))).toBe('trainer')
  })

  it('un rôle inconnu ou le super admin lui-même annule l’aperçu', () => {
    sessionStorage.setItem(CLE_APERCU, 'trainer')
    expect(lireApercu(ici('?apercu=superadmin'))).toBeNull()
    expect(sessionStorage.getItem(CLE_APERCU)).toBeNull()
    expect(lireApercu(ici('?apercu=pirate'))).toBeNull()
  })

  it('hors aperçu, rien', () => {
    expect(lireApercu(ici(''))).toBeNull()
    sessionStorage.setItem(CLE_APERCU, 'trainer')
    quitterApercu()
    expect(lireApercu(ici(''))).toBeNull()
  })

  it('le compte garde son identité, avec le seul rôle de l’aperçu', () => {
    const vu = utilisateurApercu({ sub: 's1', roles: ['superadmin'], firstName: 'A' }, 'dps')
    expect(vu).toMatchObject({ sub: 's1', firstName: 'A', roles: ['dps'], apercu: 'dps' })
  })
})

describe('ouverture', () => {
  it('nouvelle fenêtre (popup), une par rôle, sans noopener', () => {
    const fenetre = { focus: vi.fn() }
    const win = { open: vi.fn(() => fenetre), screen: { availWidth: 1280, availHeight: 800 } }
    ouvrirApercu('training_coordinator', win)
    const [url, nom, options] = win.open.mock.calls[0]
    expect(url).toBe(urlApercu('training_coordinator'))
    expect(url).toBe('/portail?apercu=training_coordinator')
    expect(nom).toBe('apercu-training_coordinator')
    expect(options).toContain('popup=yes')
    expect(options).toContain('width=1280')
    expect(options).not.toContain('noopener')
    expect(fenetre.focus).toHaveBeenCalled()
  })
})

describe('lecture seule', () => {
  let rendre
  afterEach(() => rendre?.())

  it('les lectures et le renouvellement du jeton passent, les écritures sont refusées', async () => {
    const origine = vi.fn(async () => new Response('{}', { status: 200 }))
    const win = { fetch: origine }
    rendre = verrouillerEcritures(win)

    await win.fetch('/api/v1/planning/years')
    await win.fetch('/api/x', { method: 'get' })
    await win.fetch('https://kc/realms/cfao/protocol/openid-connect/token', { method: 'POST' })
    expect(origine).toHaveBeenCalledTimes(3)

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const r = await win.fetch('/api/v1/needs', { method })
      expect(r.status).toBe(403)
    }
    const r = await win.fetch(new Request('http://x.test/api/y', { method: 'POST' }))
    expect(r.status).toBe(403)
    expect(origine).toHaveBeenCalledTimes(3)

    rendre()
    expect(win.fetch).toBe(origine)
  })

  it('ne s’empile pas', () => {
    const win = { fetch: vi.fn() }
    rendre = verrouillerEcritures(win)
    const garde = win.fetch
    verrouillerEcritures(win)
    expect(win.fetch).toBe(garde)
  })
})
