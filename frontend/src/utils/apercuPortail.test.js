// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLE_APERCU,
  CLE_CIBLE,
  CLE_NOM_CIBLE,
  EN_TETE_VU_COMME,
  ROLES_APERCU,
  accesLecture,
  comptesApercu,
  lireApercu,
  lireCible,
  lireNomCible,
  ouvrirApercu,
  peutOuvrirApercu,
  quitterApercu,
  urlApercu,
  utilisateurApercu,
  verrouillerEcritures,
} from './apercuPortail.js'

const ici = (search = '') => ({ search })
const CIBLE = '0b6f2c1e-9a4d-4c3b-8e2f-1d7a5b9c3e40'

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

  it('droits planning en aperçu : la lecture reste, l’écriture tombe', () => {
    const droits = { view: true, review: true, gaps: true, manage: true, freeze: true, edit: true, import: true }
    expect(accesLecture(droits, 'center_director'))
      .toEqual({ view: true, review: true, gaps: true, manage: false, freeze: false, edit: false, import: false })
    expect(accesLecture(droits, null)).toBe(droits)
    expect(accesLecture(null, 'trainer')).toBeNull()
  })

  it('le compte garde son identité, avec le seul rôle de l’aperçu', () => {
    const vu = utilisateurApercu({ sub: 's1', roles: ['superadmin'], firstName: 'A' }, 'dps')
    expect(vu).toMatchObject({ sub: 's1', firstName: 'A', roles: ['dps'], apercu: 'dps' })
  })
})

describe('compte cible (vu comme)', () => {
  it('retient un identifiant de compte, annule toute autre valeur', () => {
    expect(lireCible(ici(`?apercu=trainer&cible=${CIBLE.toUpperCase()}`))).toBe(CIBLE)
    expect(sessionStorage.getItem(CLE_CIBLE)).toBe(CIBLE)
    expect(lireCible(ici(''))).toBe(CIBLE)
    expect(lireCible(ici('?apercu=trainer&cible=1;drop'))).toBeNull()
    expect(sessionStorage.getItem(CLE_CIBLE)).toBeNull()
  })

  it('un aperçu de structure (sans cible) efface la cible retenue', () => {
    sessionStorage.setItem(CLE_CIBLE, CIBLE)
    expect(lireCible(ici('?apercu=trainer'))).toBeNull()
    expect(sessionStorage.getItem(CLE_CIBLE)).toBeNull()
  })

  it('comptes proposés : un portail d’aperçu, son rôle le plus haut, jamais un super admin', () => {
    const autre = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
    const liste = comptesApercu([
      { id: CIBLE, first_name: 'B', last_name: 'Compte', roles: ['trainer', 'training_coordinator'] },
      { id: autre, first_name: '', last_name: '', email: 'a@x.test', roles: ['learner'] },
      { id: 'pas-un-uuid', first_name: 'C', roles: ['trainer'] },
      { id: '2c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', first_name: 'D', roles: ['superadmin', 'trainer'] },
      { id: '3c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', first_name: 'E', roles: [] },
    ])
    expect(liste).toEqual([
      { id: autre, nom: 'a@x.test', role: 'learner' },
      { id: CIBLE, nom: 'B Compte', role: ROLES_APERCU.find(r => ['trainer', 'training_coordinator'].includes(r)) },
    ])
    expect(comptesApercu(null)).toEqual([])
  })

  it('quitter l’aperçu oublie aussi la cible', () => {
    sessionStorage.setItem(CLE_CIBLE, CIBLE)
    quitterApercu()
    expect(lireCible(ici(''))).toBeNull()
  })

  it('une fenêtre par compte, avec la cible dans l’adresse', () => {
    let vuALouverture = null
    const win = { sessionStorage, screen: {},
      open: vi.fn(() => { vuALouverture = lireNomCible(); return null }) }
    ouvrirApercu('trainer', win, CIBLE, 'Compte test')
    const [url, nom] = win.open.mock.calls[0]
    expect(url).toBe(`/portail?apercu=trainer&cible=${CIBLE}`)
    expect(url).not.toContain('Compte')
    expect(nom).toBe(`apercu-trainer-${CIBLE}`)
    // Le nom n'est là que le temps de l'ouverture (copie du sessionStorage).
    expect(vuALouverture).toBe('Compte test')
    expect(sessionStorage.getItem(CLE_NOM_CIBLE)).toBeNull()
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

  it('vu comme : seules les lectures de nos API portent l’en-tête', async () => {
    const origine = vi.fn(async () => new Response('{}', { status: 200 }))
    const win = { fetch: origine, location: { href: 'https://portail.test/portail?apercu=trainer' } }
    rendre = verrouillerEcritures(win, CIBLE)
    const entete = i => new Headers(origine.mock.calls[i][1]?.headers).get(EN_TETE_VU_COMME)

    await win.fetch('/api/v1/core/me', { headers: { Authorization: 'Bearer j' } })
    expect(entete(0)).toBe(CIBLE)
    expect(new Headers(origine.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer j')
    await win.fetch('https://portail.test/api/v1/planning/me/sessions', { method: 'HEAD' })
    expect(entete(1)).toBe(CIBLE)

    await win.fetch('https://kc/realms/cfao/protocol/openid-connect/token', { method: 'POST' })
    await win.fetch('https://ailleurs.test/api/v1/core/me')
    await win.fetch('/portail/logo.svg')
    expect([entete(2), entete(3), entete(4)]).toEqual([null, null, null])

    const r = await win.fetch('/api/v1/needs', { method: 'POST' })
    expect(r.status).toBe(403)
    expect(origine).toHaveBeenCalledTimes(5)
  })

  it('ne s’empile pas', () => {
    const win = { fetch: vi.fn() }
    rendre = verrouillerEcritures(win)
    const garde = win.fetch
    verrouillerEcritures(win)
    expect(win.fetch).toBe(garde)
  })
})
