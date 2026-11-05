import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Un navigateur : un stockage local partage par ses onglets. Chaque
// onglet est une instance neuve du module (`vi.resetModules`).
let stockage
let envois
let reponse

function navigateur() {
  stockage = new Map()
  envois = []
  reponse = corps => ({ status: 200, json: { ecrit: true, brouillon: { ...corps, revision: corps.revision + 1 } } })
  const magasin = m => ({
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  })
  vi.stubGlobal('localStorage', magasin(stockage))
  vi.stubGlobal('sessionStorage', magasin(new Map([['cfao_mock_user', '{"id":"f1"}']])))
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('fetch', async (url, options = {}) => {
    if (options.method !== 'PUT') return { ok: false, status: 404, json: async () => ({}) }
    const corps = JSON.parse(options.body)
    envois.push(corps)
    const { status, json } = reponse(corps)
    return { ok: status === 200, status, json: async () => json }
  })
}

async function onglet() {
  vi.resetModules()
  return import('./brouillonsCompteRendu')
}

// Laisse partir l'envoi differe et arriver sa reponse.
async function envoyer() {
  await vi.advanceTimersByTimeAsync(1000)
}

const V1 = { sessionId: 's1', textes: { a: 'v1' }, phase: 1, revision: 1, ecrivain: 'x' }
const local = () => JSON.parse(stockage.get('cfao.comptes-rendus.f1'))

beforeEach(() => {
  vi.useFakeTimers()
  navigateur()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('deux onglets sur le meme compte rendu', () => {
  it('l\'onglet reste sur une copie ancienne ne l\'enregistre pas par-dessus l\'autre', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    const b = await onglet()
    b.adopter('s1', V1)
    b.enregistrer('s1', { ...V1, textes: { a: 'v2' } })
    await envoyer()
    expect(local()).toMatchObject({ s1: { textes: { a: 'v2' }, revision: 2 } })

    // A se ferme sans rien avoir saisi : rien ne part.
    envois = []
    expect(a.enregistrer('s1', V1)).toBe(true)
    await envoyer()
    expect(envois).toEqual([])

    // A retouche sa copie ancienne : refusee et signalee, sans rien ecraser.
    const signale = vi.fn()
    a.surveiller('s1', signale)
    expect(a.enregistrer('s1', { ...V1, textes: { a: 'v1 retouchee' } })).toBe(false)
    await envoyer()
    expect(envois).toEqual([])
    expect(signale).toHaveBeenCalledWith(expect.objectContaining({ textes: { a: 'v2' } }))
    expect(local().s1.textes.a).toBe('v2')
  })

  it('un envoi refuse par le serveur previent l\'ecran avec la version gardee', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    reponse = () => ({ status: 409, json: { ecrit: false, conflit: true, brouillon: { ...V1, textes: { a: 'poste B' }, revision: 5 } } })
    const signale = vi.fn()
    a.surveiller('s1', signale)
    a.enregistrer('s1', { ...V1, textes: { a: 'v1 retouchee' } })
    await envoyer()
    expect(envois[0].revision).toBe(1)
    expect(signale).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 }))
  })

  it('garder sa version la renvoie depuis la plus recente', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    a.garder('s1', { ...V1, textes: { a: 'la mienne' } }, { ...V1, revision: 5 })
    await envoyer()
    expect(envois[0]).toMatchObject({ revision: 5, textes: { a: 'la mienne' } })
  })

  it('les envois successifs d\'un onglet repartent de sa derniere revision', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    a.enregistrer('s1', { ...V1, textes: { a: 'v2' } })
    await envoyer()
    a.enregistrer('s1', { ...V1, textes: { a: 'v3' } })
    await envoyer()
    expect(envois.map(e => e.revision)).toEqual([1, 2])
  })
})

describe('un brouillon supprime sur un autre poste', () => {
  function supprimeAilleurs(supprimes, revisionsSupprimees) {
    const put = globalThis.fetch
    vi.stubGlobal('fetch', async (url, options = {}) => (options.method === 'PUT'
      ? put(url, options)
      : { ok: true, status: 200, json: async () => ({ brouillons: [], supprimes, revisionsSupprimees }) }))
  }

  it('une copie deja enregistree disparait, meme datee apres la suppression', async () => {
    const a = await onglet()
    a.adopter('s1', { ...V1, modifieLe: '2099-01-01T00:00:00.000Z' })
    supprimeAilleurs({ s1: '2026-01-01T00:00:00.000Z' }, { s1: 1 })
    expect(await a.synchroniser()).toEqual([])
    await envoyer()
    expect(envois).toEqual([])
  })

  it('un nouveau brouillon jamais enregistre est garde et envoye', async () => {
    const a = await onglet()
    stockage.set('cfao.comptes-rendus.f1', JSON.stringify({
      s1: { sessionId: 's1', textes: { a: 'neuf' }, modifieLe: '2000-01-01T00:00:00.000Z' },
    }))
    supprimeAilleurs({ s1: '2026-01-01T00:00:00.000Z' }, { s1: 1 })
    expect(await a.synchroniser()).toHaveLength(1)
    await envoyer()
    expect(envois).toMatchObject([{ textes: { a: 'neuf' }, revision: 0 }])
  })

  it('sans revision connue, la date departage encore', async () => {
    const a = await onglet()
    a.adopter('s1', { ...V1, modifieLe: '2026-02-01T00:00:00.000Z' })
    supprimeAilleurs({ s1: '2026-01-01T00:00:00.000Z' }, undefined)
    expect(await a.synchroniser()).toHaveLength(1)
  })
})

describe('une saisie en cours sur un brouillon supprime ailleurs', () => {
  it('n\'est pas perdue : elle repart comme un nouveau brouillon', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    reponse = corps => (corps.revision > 0
      ? { status: 200, json: { ecrit: false, brouillon: null } }
      : { status: 200, json: { ecrit: true, brouillon: { ...corps, revision: 3 } } })
    a.enregistrer('s1', { ...V1, textes: { a: 'saisie' } })
    await envoyer()
    await envoyer()
    expect(envois.map(e => e.revision)).toEqual([1, 0])
    expect(local()).toMatchObject({ s1: { textes: { a: 'saisie' }, revision: 3 } })
  })

  it('la synchronisation garde la saisie qui attend de partir', async () => {
    const a = await onglet()
    a.adopter('s1', V1)
    a.enregistrer('s1', { ...V1, textes: { a: 'saisie' } })
    const put = globalThis.fetch
    vi.stubGlobal('fetch', async (url, options = {}) => (options.method === 'PUT'
      ? put(url, options)
      : { ok: true, status: 200, json: async () => ({ brouillons: [], supprimes: { s1: '2026-01-01' }, revisionsSupprimees: { s1: 1 } }) }))
    expect(await a.synchroniser()).toHaveLength(1)
    await envoyer()
    expect(envois).toMatchObject([{ textes: { a: 'saisie' }, revision: 0 }])
  })
})

describe('une session du planning retouchee sans note', () => {
  const session = {
    sessionId: 's2', manuel: false, debut: '2026-10-12', fin: '2026-10-16',
    participants: [{ id: 'p1', prenom: 'Alain', nom: 'K', present: true }],
  }

  it('s’enregistre et figure parmi les comptes rendus en cours', async () => {
    const m = await onglet()
    expect(m.enregistrer('s2', { ...session, infosModifiees: true })).toBe(true)
    await envoyer()
    expect(envois).toHaveLength(1)
    expect(local().s2.debut).toBe('2026-10-12')
    expect(m.brouillonsEnregistres().map(b => b.id)).toContain('s2')
  })

  it('reste non enregistree tant que rien n’est retouche', async () => {
    const m = await onglet()
    m.enregistrer('s2', session)
    await envoyer()
    expect(envois).toHaveLength(0)
  })
})

describe('aDuContenu', () => {
  it("une saisie libre sans information n'est pas un compte rendu", async () => {
    const m = await onglet()
    const vide = { sessionId: 'manuel-1', manuel: true, codeFormation: ' ', type: 'formation', infosModifiees: true }
    expect(m.aDuContenu(vide)).toBe(false)
    expect(m.aDuContenu({ ...vide, intitule: 'Freinage' })).toBe(true)
    expect(m.aDuContenu({ sessionId: 's1', infosModifiees: true })).toBe(true)
  })
})
