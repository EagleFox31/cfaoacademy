import { afterEach, describe, expect, it, vi } from 'vitest'
import { lireErreurs, signalerErreur } from './journalErreurs'

afterEach(() => vi.unstubAllGlobals())

describe('journal des erreurs', () => {
  it("signale l'action, le message et le contexte sans jamais lever", () => {
    const appel = vi.fn(() => Promise.reject(new Error('hors ligne')))
    vi.stubGlobal('fetch', appel)
    expect(() => signalerErreur("apercu d'une page", new Error('504'), { diapo: 4 })).not.toThrow()
    const [route, options] = appel.mock.calls[0]
    const corps = JSON.parse(options.body)
    expect(route).toBe('/cr-donnees/erreurs')
    expect(corps).toMatchObject({ action: "apercu d'une page", message: '504', contexte: { diapo: 4 } })
  })

  it("rend null quand l'accès est refusé, la liste sinon", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 403, ok: false })))
    expect(await lireErreurs()).toBeNull()
    const appel = vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ erreurs: [{ id: 1 }] }) }))
    vi.stubGlobal('fetch', appel)
    expect(await lireErreurs('service')).toEqual([{ id: 1 }])
    expect(appel).toHaveBeenCalledWith('/cr-donnees/erreurs?origine=service')
  })
})
