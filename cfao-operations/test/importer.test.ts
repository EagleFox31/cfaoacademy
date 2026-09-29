import { beforeAll, describe, expect, it } from 'vitest'
import { newDb } from 'pg-mem'
import { getPool, setPool } from '../src/db/pool.js'
import { migrer } from '../src/db/migrations.js'
import { importer, lireComptes } from '../src/scripts/importer-brouillons.js'
import * as repo from '../src/modules/reports/repo.js'

beforeAll(async () => {
  const { Pool } = newDb().adapters.createPg()
  setPool(new Pool())
  await migrer(getPool())
})

const EXPORT = {
  brouillons: [
    { compte: 'u10', id: 'manuel-1', contenu: { intitule: 'G2', photos: { j: [{ apercu: '/cr-donnees/photos/0123456789abcdef.jpg' }] } }, modifieLe: '2026-09-01T10:00:00.000Z' },
    { compte: 'u99', id: 'manuel-2', contenu: {}, modifieLe: '2026-09-01T10:00:00.000Z' },
  ],
  supprimes: [{ compte: 'u10', id: 'manuel-0', le: '2026-08-01T10:00:00.000Z' }],
}

describe('import des brouillons de l’ancien stockage', () => {
  const comptes = lireComptes(['--compte', 'u10=sub-eugene@groupe,groupe.cmr'])

  it('lit la correspondance des comptes', () => {
    expect(comptes).toEqual({ u10: { sub: 'sub-eugene', orgPath: ['groupe', 'groupe.cmr'] } })
    expect(() => lireComptes(['--compte', 'u10'])).toThrow()
  })

  it('range les brouillons sous le sub Keycloak et ignore les comptes inconnus', async () => {
    const bilan = await importer(EXPORT, comptes)
    expect(bilan).toMatchObject({ ecrits: 1, supprimes: 1, ignores: ['u99/manuel-2'] })
    const b = await repo.lire('sub-eugene', 'manuel-1')
    expect(b).toMatchObject({ orgPath: ['groupe', 'groupe.cmr'], contenu: { intitule: 'G2' } })
    expect(JSON.stringify(b!.contenu)).toContain('/apercu/photos/0123456789abcdef.jpg')
    expect(JSON.stringify(b!.contenu)).not.toContain('/cr-donnees/')
  })

  it('ne duplique rien quand on relance', async () => {
    const bilan = await importer(EXPORT, comptes)
    expect(bilan.ecrits + bilan.gardes).toBe(1)
    expect((await repo.lister({ sql: 'TRUE', values: [] }, 'sub-eugene')).length).toBe(1)
  })
})
