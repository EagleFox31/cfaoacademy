// @vitest-environment jsdom
import { act, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/sessionContext.js'
import { LocaleProvider } from '../context/LocaleProvider.jsx'
import ApercuProvider from './ApercuProvider.jsx'
import { CLE_APERCU } from '../utils/apercuPortail.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let racine
let conteneur
const fetchOrigine = globalThis.fetch

async function monter(user, logout = vi.fn()) {
  const sonde = { user: null, logout: null }
  function Sonde() {
    const ctx = useContext(AuthContext)
    sonde.user = ctx.user
    sonde.logout = ctx.logout
    return null
  }
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  await act(async () => {
    racine.render(
      <AuthContext.Provider value={{ user, status: 'ready', logout }}>
        <LocaleProvider>
          <ApercuProvider><Sonde /></ApercuProvider>
        </LocaleProvider>
      </AuthContext.Provider>,
    )
  })
  return sonde
}

beforeEach(() => {
  sessionStorage.clear()
  globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 }))
})

afterEach(() => {
  act(() => racine?.unmount())
  conteneur?.remove()
  globalThis.fetch = fetchOrigine
})

const SUPER = { sub: 's1', firstName: 'Admin', roles: ['superadmin'] }

describe('ApercuProvider', () => {
  it('sans aperçu, le compte est inchangé et aucun bandeau', async () => {
    const sonde = await monter(SUPER)
    expect(sonde.user).toBe(SUPER)
    expect(conteneur.querySelector('.portal-apercu-bandeau')).toBeNull()
  })

  it('en aperçu, le super admin voit avec le rôle choisi, bandeau affiché, écritures refusées', async () => {
    sessionStorage.setItem(CLE_APERCU, 'training_coordinator')
    const sonde = await monter(SUPER)
    expect(sonde.user).toMatchObject({ sub: 's1', roles: ['training_coordinator'], apercu: 'training_coordinator' })
    const bandeau = conteneur.querySelector('.portal-apercu-bandeau')
    expect(bandeau?.textContent).toContain('Coordinateur formations')
    const r = await globalThis.fetch('/api/v1/needs', { method: 'POST' })
    expect(r.status).toBe(403)
  })

  it('un autre compte ne peut pas se servir de l’aperçu', async () => {
    sessionStorage.setItem(CLE_APERCU, 'trainer')
    const coordinateur = { sub: 'c1', roles: ['training_coordinator'] }
    const sonde = await monter(coordinateur)
    expect(sonde.user).toBe(coordinateur)
    expect(conteneur.querySelector('.portal-apercu-bandeau')).toBeNull()
  })

  it('« Fermer l’aperçu » oublie le rôle et ferme la fenêtre', async () => {
    sessionStorage.setItem(CLE_APERCU, 'dps')
    const fermer = vi.spyOn(window, 'close').mockImplementation(() => {})
    const sonde = await monter(SUPER)
    await act(async () => { conteneur.querySelector('.portal-apercu-bandeau button').click() })
    expect(fermer).toHaveBeenCalled()
    expect(sessionStorage.getItem(CLE_APERCU)).toBeNull()
    expect(sonde.user).toBe(SUPER)
    fermer.mockRestore()
  })

  it('« Déconnexion » dans l’aperçu ferme l’aperçu sans déconnecter le vrai compte', async () => {
    sessionStorage.setItem(CLE_APERCU, 'trainer')
    const fermer = vi.spyOn(window, 'close').mockImplementation(() => {})
    const vraiLogout = vi.fn()
    const sonde = await monter(SUPER, vraiLogout)
    await act(async () => { sonde.logout() })
    expect(vraiLogout).not.toHaveBeenCalled()
    expect(fermer).toHaveBeenCalled()
    expect(sessionStorage.getItem(CLE_APERCU)).toBeNull()
    expect(sonde.user).toBe(SUPER)
    fermer.mockRestore()
  })

  it('hors aperçu, la déconnexion reste la vraie', async () => {
    const vraiLogout = vi.fn()
    const sonde = await monter(SUPER, vraiLogout)
    expect(sonde.logout).toBe(vraiLogout)
  })
})
