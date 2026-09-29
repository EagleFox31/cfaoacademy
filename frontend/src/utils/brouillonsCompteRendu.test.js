import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Un stockage de navigateur minimal : les tests tournent sous Node.
const stockage = () => {
  const m = new Map()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}

let appels
beforeEach(() => {
  globalThis.localStorage = stockage()
  globalThis.sessionStorage = stockage()
  appels = []
  globalThis.fetch = vi.fn(async (url, options) => {
    appels.push({ url, options })
    return {
      status: 200, ok: true,
      text: async () => JSON.stringify({
        _id: 'manuel-1', intitule: 'G2', modifieLe: '2030-01-01T00:00:00.000Z',
        photos: { j: [{ apercu: '/cr-donnees/photos/0123456789abcdef.jpg' }] },
      }),
    }
  })
})
afterEach(() => vi.restoreAllMocks())

describe('brouillons cote serveur (cfao-operations)', () => {
  it('appelle l’API de cfao-operations avec le cookie de session, sans identifiant', async () => {
    const { recupererDuServeur } = await import('./brouillonsCompteRendu')
    await recupererDuServeur('manuel-1')
    expect(appels[0].url).toBe('/api/v1/ops/reports/drafts/manuel-1')
    expect(appels[0].options.credentials).toBe('same-origin')
    expect(appels[0].options.headers).not.toHaveProperty('X-Utilisateur')
  })

  it('reecrit l’ancienne adresse des photos', async () => {
    const { recupererDuServeur } = await import('./brouillonsCompteRendu')
    const b = await recupererDuServeur('manuel-1')
    expect(b.photos.j[0].apercu).toBe('/apercu/photos/0123456789abcdef.jpg')
  })
})
