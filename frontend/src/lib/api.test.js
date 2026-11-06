import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth', () => ({
  ensureFreshToken: vi.fn(async () => ({ accessToken: 'jeton' })),
  readSession: vi.fn(() => ({ accessToken: 'jeton' })),
  reauthenticate: vi.fn(),
  refreshSession: vi.fn(async () => false),
}))

const { createClient, isMaintenance, isMaintenanceError, MAINTENANCE_MAX_MS } = await import('./api')

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const attente = () => json(503, { detail: 'maintenance' }, { 'Retry-After': '15' })

const client = createClient('/api/v1/planning')

describe('client API pendant une mise à jour (503 de cfao-edge)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('une lecture attend Retry-After puis réessaie seule', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(attente()).mockResolvedValueOnce(json(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)
    const promesse = client.get('/access')
    await vi.advanceTimersByTimeAsync(0)
    expect(isMaintenance()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)
    await expect(promesse).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(isMaintenance()).toBe(false)
  })

  it("une écriture n'est jamais rejouée", async () => {
    const fetch = vi.fn().mockResolvedValue(attente())
    vi.stubGlobal('fetch', fetch)
    const erreur = await client.post('/imports', { body: {} }).catch(e => e)
    expect(isMaintenanceError(erreur)).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("un 503 de l'API elle-même reste une erreur ordinaire", async () => {
    const fetch = vi.fn().mockResolvedValue(json(503, { error: { code: 'needs_unavailable', message: 'x' } }))
    vi.stubGlobal('fetch', fetch)
    const erreur = await client.get('/coverage').catch(e => e)
    expect(erreur.status).toBe(503)
    expect(isMaintenanceError(erreur)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("au-delà de l'attente maximale, l'erreur remonte à l'écran", async () => {
    const fetch = vi.fn().mockImplementation(async () => attente())
    vi.stubGlobal('fetch', fetch)
    const promesse = client.get('/access').catch(e => e)
    await vi.advanceTimersByTimeAsync(MAINTENANCE_MAX_MS + 15_000)
    const erreur = await promesse
    expect(isMaintenanceError(erreur)).toBe(true)
    expect(isMaintenance()).toBe(false)
    expect(fetch.mock.calls.length).toBeGreaterThan(30)
  })
})
