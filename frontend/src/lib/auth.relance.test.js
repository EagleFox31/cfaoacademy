// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CALLBACK_INVALID, handleCallback, relancerConnexionUneFois } from './auth'

describe('retour Keycloak dont le state ne correspond plus', () => {
  let assign

  beforeEach(() => {
    sessionStorage.clear()
    assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign, href: 'http://localhost/callback?code=c&state=autre', origin: 'http://localhost' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('refuse le retour sans appeler Keycloak', async () => {
    sessionStorage.setItem('cfao.pkce.state', 'attendu')
    sessionStorage.setItem('cfao.pkce.verifier', 'v')
    const fetchEspion = vi.fn()
    vi.stubGlobal('fetch', fetchEspion)
    await expect(handleCallback()).rejects.toThrow(CALLBACK_INVALID)
    expect(fetchEspion).not.toHaveBeenCalled()
  })

  it('relance la connexion une seule fois, puis laisse afficher l’erreur', async () => {
    expect(relancerConnexionUneFois()).toBe(true)
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign.mock.calls[0][0]).toContain('/protocol/openid-connect/auth?')
    expect(relancerConnexionUneFois()).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('autorise une nouvelle relance passé deux minutes', () => {
    vi.useFakeTimers()
    expect(relancerConnexionUneFois()).toBe(true)
    vi.advanceTimersByTime(2 * 60_000 + 1)
    expect(relancerConnexionUneFois()).toBe(true)
  })
})
