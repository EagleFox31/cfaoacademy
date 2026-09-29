// Integration du module reports : JWT (JWKS local a la place de Keycloak),
// PEP Cerbos (faux PDP appliquant la regle de trainer_report.yaml), ops-db (pg-mem).
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose'
import { newDb } from 'pg-mem'

const ISSUER = 'http://keycloak.test/realms/cfao'
let cle: KeyLike
let base = ''
const serveurs: Server[] = []

function ecouter(gestion: Parameters<typeof createServer>[1]): Promise<string> {
  const s = createServer(gestion)
  serveurs.push(s)
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)))
}

const corpsDe = (req: import('node:http').IncomingMessage) =>
  new Promise<any>(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => r(JSON.parse(d || '{}'))) })

// Le faux PDP : la regle de la policy trainer_report (proprietaire, directeur dans son perimetre).
const autorise = (p: any, attr: any, action: string) => {
  if (p.roles.includes('superadmin')) return true
  const proprietaire = attr.ownerId === p.id && (p.roles.includes('trainer') || p.roles.includes('center_director'))
  if (proprietaire && ['create', 'view', 'update', 'delete'].includes(action)) return true
  return action === 'view' && p.roles.includes('center_director')
    && p.attr.scopeNodes.some((s: string) => attr.orgPath.includes(s))
}

async function jeton(sub: string, roles: string[], scopeNode = 'groupe.cmr.douala') {
  return new SignJWT({ realm_access: { roles }, scopeNode, orgPath: ['groupe', 'groupe.cmr', scopeNode] })
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setSubject(sub).setIssuer(ISSUER).setIssuedAt().setExpirationTime('5m')
    .sign(cle)
}

async function appel(methode: string, chemin: string, jwt?: string, corps?: unknown) {
  const r = await fetch(`${base}/api/v1/ops${chemin}`, {
    method: methode,
    headers: { 'content-type': 'application/json', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  return { statut: r.status, json: await r.json() as any }
}

beforeAll(async () => {
  const paire = await generateKeyPair('RS256')
  cle = paire.privateKey
  const jwk = { ...(await exportJWK(paire.publicKey)), kid: 'test', alg: 'RS256', use: 'sig' }
  const jwks = await ecouter((_q, s) => { s.setHeader('content-type', 'application/json'); s.end(JSON.stringify({ keys: [jwk] })) })
  const cerbos = await ecouter(async (q, s) => {
    const c = await corpsDe(q)
    s.setHeader('content-type', 'application/json')
    if (q.url === '/api/check/resources') {
      const { resource, actions } = c.resources[0]
      const effet = autorise(c.principal, resource.attr, actions[0]) ? 'EFFECT_ALLOW' : 'EFFECT_DENY'
      return s.end(JSON.stringify({ results: [{ actions: { [actions[0]]: effet } }] }))
    }
    // Plan : le formateur voit ses rapports ; le directeur, aussi son perimetre.
    const p = c.principal
    const proprio = { expression: { operator: 'eq', operands: [{ variable: 'request.resource.attr.ownerId' }, { value: p.id }] } }
    const filtre = p.roles.includes('center_director')
      ? { kind: 'KIND_CONDITIONAL', condition: { expression: { operator: 'or', operands: [proprio, { expression: { operator: 'exists', operands: [
        { value: p.attr.scopeNodes },
        { expression: { operator: 'lambda', operands: [
          { expression: { operator: 'in', operands: [{ variable: 's' }, { variable: 'request.resource.attr.orgPath' }] } },
          { variable: 's' }] } }] } }] } } }
      : p.roles.includes('trainer') ? { kind: 'KIND_CONDITIONAL', condition: proprio } : { kind: 'KIND_ALWAYS_DENIED' }
    s.end(JSON.stringify({ filter: filtre }))
  })
  process.env.OIDC_JWKS_URL = jwks
  process.env.OIDC_ISSUER = ISSUER
  process.env.CERBOS_HTTP = cerbos

  const { setPool } = await import('../src/db/pool.js')
  const { migrer } = await import('../src/db/migrations.js')
  const { Pool } = newDb().adapters.createPg()
  setPool(new Pool())
  await migrer((await import('../src/db/pool.js')).getPool())
  const { app } = await import('../src/app.js')
  base = await ecouter(app)
})

afterAll(() => serveurs.forEach(s => s.close()))

describe('brouillons de rapport', () => {
  it('refuse une requete sans jeton ou avec un jeton invalide', async () => {
    expect((await appel('GET', '/reports/drafts')).statut).toBe(401)
    expect((await appel('GET', '/reports/drafts', 'pas.un.jeton')).statut).toBe(401)
  })

  it('enregistre puis relit le brouillon du formateur', async () => {
    const t = await jeton('t_a', ['trainer'])
    const e = await appel('PUT', '/reports/drafts/manuel-1', t, { intitule: 'G2', modifieLe: '2026-09-01T10:00:00.000Z' })
    expect(e.statut).toBe(200)
    expect(e.json.ecrit).toBe(true)
    expect((await appel('GET', '/reports/drafts/manuel-1', t)).json.intitule).toBe('G2')
    expect((await appel('GET', '/reports/drafts', t)).json.brouillons.map((b: any) => b.intitule)).toEqual(['G2'])
  })

  it('garde la version la plus recente', async () => {
    const t = await jeton('t_a', ['trainer'])
    await appel('PUT', '/reports/drafts/manuel-2', t, { v: 2, modifieLe: '2026-09-02T10:00:00.000Z' })
    const ancien = await appel('PUT', '/reports/drafts/manuel-2', t, { v: 1, modifieLe: '2026-09-01T10:00:00.000Z' })
    expect(ancien.json).toMatchObject({ ecrit: false, brouillon: { v: 2 } })
  })

  it('un autre formateur ne voit pas le brouillon (negatif)', async () => {
    const autre = await jeton('t_b', ['trainer'])
    expect((await appel('GET', '/reports/drafts/manuel-1?proprietaire=t_a', autre)).statut).toBe(403)
    expect((await appel('GET', '/reports/drafts?portee=tous', autre)).json.brouillons).toEqual([])
  })

  it('un apprenant ne peut rien creer (negatif)', async () => {
    const l = await jeton('l_1', ['learner'])
    expect((await appel('PUT', '/reports/drafts/manuel-9', l, { x: 1 })).statut).toBe(403)
  })

  it('le directeur du centre voit le perimetre mais ne modifie rien', async () => {
    const d = await jeton('d_cmr', ['center_director'], 'groupe.cmr')
    const liste = await appel('GET', '/reports/drafts?portee=tous', d)
    expect(liste.json.brouillons.map((b: any) => b._proprietaire)).toContain('t_a')
    expect((await appel('GET', '/reports/drafts/manuel-1?proprietaire=t_a', d)).statut).toBe(200)
    const hors = await jeton('d_civ', ['center_director'], 'groupe.civ')
    expect((await appel('GET', '/reports/drafts/manuel-1?proprietaire=t_a', hors)).statut).toBe(403)
  })

  it('une suppression est gardee et empeche un retour d’une copie ancienne', async () => {
    const t = await jeton('t_a', ['trainer'])
    await appel('PUT', '/reports/drafts/manuel-3', t, { modifieLe: '2026-09-01T10:00:00.000Z' })
    expect((await appel('DELETE', '/reports/drafts/manuel-3', t)).statut).toBe(200)
    const liste = await appel('GET', '/reports/drafts', t)
    expect(Object.keys(liste.json.supprimes)).toContain('manuel-3')
    const retour = await appel('PUT', '/reports/drafts/manuel-3', t, { modifieLe: '2026-09-01T10:00:00.000Z' })
    expect(retour.json.ecrit).toBe(false)
  })

  it('refuse un identifiant qui ressemble a un chemin', async () => {
    const t = await jeton('t_a', ['trainer'])
    expect((await appel('PUT', '/reports/drafts/..%2Fx', t, {})).statut).toBe(400)
  })
})
