import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appelPlateforme } from './appelPlateforme'

const stockage = () => {
  const m = new Map()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}

let assign
beforeEach(() => {
  globalThis.sessionStorage = stockage()
  assign = vi.fn()
  globalThis.window = { location: { pathname: '/portail/compte-rendu/nouveau', search: '?session=s1', hash: '', assign } }
})

const repondre = status => { globalThis.fetch = vi.fn(async () => ({ status, ok: status < 400 })) }

describe('appelPlateforme', () => {
  it('envoie le cookie de session', async () => {
    repondre(200)
    await appelPlateforme('/apercu/page', { method: 'POST' })
    expect(fetch).toHaveBeenCalledWith('/apercu/page', { credentials: 'same-origin', method: 'POST' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('sans session, part se connecter puis revient sur la page', async () => {
    repondre(401)
    await appelPlateforme('/api/v1/ops/reports/drafts')
    expect(assign).toHaveBeenCalledWith(
      `/oauth2/start?rd=${encodeURIComponent('/portail/compte-rendu/nouveau?session=s1')}`)
  })

  it('ne boucle pas si la connexion echoue', async () => {
    repondre(401)
    await appelPlateforme('/apercu/page')
    await appelPlateforme('/apercu/page')
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('un refus d’acces (403) ne renvoie pas a la connexion', async () => {
    repondre(403)
    await appelPlateforme('/apercu/page')
    expect(assign).not.toHaveBeenCalled()
  })
})
