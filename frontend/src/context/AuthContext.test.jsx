// @vitest-environment jsdom
import { act, useContext } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ISSUER = 'http://kc.exemple.test/realms/cfao'

/** Reponses du faux serveur, par debut de chemin. */
function fauxServeur(routes) {
  const appels = []
  globalThis.fetch = vi.fn(async (url) => {
    const chemin = String(url)
    appels.push(chemin)
    const cle = Object.keys(routes).find(prefixe => chemin.startsWith(prefixe))
    const reponse = cle ? routes[cle] : { status: 404 }
    if (reponse === 'reseau') throw new TypeError('network')
    return {
      ok: reponse.status >= 200 && reponse.status < 300,
      status: reponse.status,
      json: async () => reponse.body ?? null,
    }
  })
  return appels
}

function sessionKeycloak(claims) {
  sessionStorage.setItem('cfao.token', JSON.stringify({
    accessToken: 'jeton-test',
    expiresAt: Date.now() + 3_600_000,
    refreshToken: null,
    idToken: 'id-test',
    claims,
  }))
}

/** Monte le provider (module charge a neuf, pour relire les variables d'env). */
async function monter() {
  vi.resetModules()
  const { AuthContext, AuthProvider } = await import('./AuthContext.jsx')
  const sonde = { valeur: null }
  function Sonde() {
    sonde.valeur = useContext(AuthContext)
    return null
  }
  const conteneur = document.createElement('div')
  const racine = createRoot(conteneur)
  await act(async () => {
    racine.render(<AuthProvider><Sonde /></AuthProvider>)
  })
  // Laisse aboutir les appels du montage (session serveur ou /me).
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  return { sonde, racine }
}

let monte
beforeEach(() => {
  sessionStorage.clear()
  vi.unstubAllEnvs()
})
afterEach(async () => {
  if (monte) await act(async () => monte.racine.unmount())
  monte = null
  const { cancelSilentRefresh } = await import('../lib/auth.js')
  cancelSilentRefresh()
})

describe('sans VITE_OIDC_ISSUER (modele actuel)', () => {
  it('ne contacte jamais Keycloak et ouvre un profil de demonstration', async () => {
    const appels = fauxServeur({ '/cr-donnees/session': { status: 401 } })
    monte = await monter()
    const auth = monte.sonde.valeur

    expect(auth.oidc).toBe(false)
    expect(auth.status).toBe('anonymous')

    await act(async () => auth.login('u9'))
    expect(monte.sonde.valeur.user.id).toBe('u9')
    expect(monte.sonde.valeur.status).toBe('ready')
    expect(appels).toEqual(['/cr-donnees/session'])
  })

  it('reprend la session de compte formateur ouverte sur le serveur', async () => {
    fauxServeur({ '/cr-donnees/session': { status: 200, body: { id: 'f-1', compte: 'formateur', roles: ['instructor'] } } })
    monte = await monter()
    expect(monte.sonde.valeur.user).toMatchObject({ compte: 'formateur', roles: ['instructor'] })
  })

  it('ignore un jeton Keycloak laisse dans le stockage', async () => {
    sessionKeycloak({ sub: 's-1', preferred_username: 'loic.traore' })
    const appels = fauxServeur({ '/cr-donnees/session': { status: 401 } })
    monte = await monter()
    expect(monte.sonde.valeur.user).toBeNull()
    expect(appels.some(c => c.includes('/me'))).toBe(false)
  })

  it('connexionSso ne redirige pas', async () => {
    fauxServeur({ '/cr-donnees/session': { status: 401 } })
    monte = await monter()
    const avant = window.location.href
    await act(async () => monte.sonde.valeur.connexionSso())
    expect(window.location.href).toBe(avant)
  })
})

describe('avec VITE_OIDC_ISSUER (Keycloak)', () => {
  beforeEach(() => vi.stubEnv('VITE_OIDC_ISSUER', ISSUER))

  it('construit le compte depuis /me et rattache le profil de demonstration', async () => {
    sessionKeycloak({ sub: 's-1', preferred_username: 'loic.traore', email: 'loic@cfao.test' })
    const appels = fauxServeur({
      '/api/v1/core/me': { status: 200, body: { roles: ['team_manager'], scopeNodes: ['CM'], source: 'identity' } },
    })
    monte = await monter()
    const { user, status, oidc } = monte.sonde.valeur

    expect(oidc).toBe(true)
    expect(status).toBe('ready')
    expect(user).toMatchObject({
      oidc: true,
      compte: 'loic.traore',
      demoKey: 'u9',
      id: 'u9',
      roles: ['team_manager'],
      scopeNodes: ['CM'],
      scopeSource: 'identity',
    })
    expect(appels).not.toContain('/cr-donnees/session')
  })

  it('reste connecte en mode degrade si /me est injoignable', async () => {
    sessionKeycloak({ sub: 's-2', preferred_username: 'inconnu', realm_access: { roles: ['learner'] } })
    fauxServeur({ '/api/v1/core/me': 'reseau' })
    monte = await monter()
    const { user, status } = monte.sonde.valeur

    expect(status).toBe('degraded')
    expect(user).toMatchObject({ compte: 'inconnu', demoKey: null, roles: ['learner'], scopeSource: 'token' })
  })

  it('sans jeton, garde la session formateur du serveur', async () => {
    fauxServeur({ '/cr-donnees/session': { status: 200, body: { id: 'f-1', compte: 'formateur', roles: ['instructor'] } } })
    monte = await monter()
    expect(monte.sonde.valeur.user.compte).toBe('formateur')
    expect(monte.sonde.valeur.user.oidc).toBeUndefined()
  })

  it('adoptSession resout le profil avant de rendre la main', async () => {
    fauxServeur({
      '/cr-donnees/session': { status: 401 },
      '/api/v1/core/me': { status: 200, body: { roles: ['group_hr'], source: 'identity' } },
    })
    monte = await monter()
    expect(monte.sonde.valeur.user).toBeNull()

    sessionKeycloak({ sub: 's-3', preferred_username: 'rh.groupe' })
    let profil
    await act(async () => {
      profil = await monte.sonde.valeur.adoptSession(JSON.parse(sessionStorage.getItem('cfao.token')))
    })
    expect(profil.roles).toEqual(['group_hr'])
    expect(monte.sonde.valeur.user.compte).toBe('rh.groupe')
  })
})

describe('demoProfileFor', () => {
  it('reconnait les alias d\'identifiant, sans tenir compte des accents ni de la casse', async () => {
    const { demoProfileFor } = await import('./AuthContext.jsx')
    expect(demoProfileFor('MA31IM')?.id).toBe('u9')
    expect(demoProfileFor('Marc Aurèle')?.id).toBe('u9')
    expect(demoProfileFor('venance.tonga@cfao.com')?.id).toBe('u12')
    expect(demoProfileFor('personne.inconnue')).toBeNull()
  })
})
