import { describe, expect, it } from 'vitest'
import { lockReason, portalMatrix, profilesInFactory } from './matrix.js'
import { PORTAL_CONFIGS } from './configs/index.js'
import { MEDACAP_ETAPES } from './schema.js'

const CONFIGS = {
  a: {
    key: 'a', ns: 'nsA',
    sections: [
      { id: 'tests', kind: 'cards', etape: 'mesurer', head: { title: 't_tests' },
        cards: [{ id: 'junior', title: 't_junior' }] },
      { id: 'journal', kind: 'cards', etape: 'appliquer', head: { title: 't_journal' },
        visibleIf: { roles: ['superadmin'] } },
      { id: 'sessions', kind: 'rich', render: 'x', etape: 'acquerir', visibleIf: { selector: 'aVenir' } },
    ],
  },
  obs: {
    key: 'obs', ns: 'nsO', observer: true,
    sections: [
      { id: 'tests', kind: 'cards', etape: 'mesurer',
        cards: [{ id: 'junior', title: 't_junior', link: { to: '/x' } }] },
    ],
  },
}

describe('portalMatrix', () => {
  const m = portalMatrix(CONFIGS, ['a', 'obs', 'sans'])

  it('groupe les lignes dans l\'ordre des étapes MEDACAP, sans étape vide', () => {
    expect(m.map(g => g.etape)).toEqual(['mesurer', 'acquerir', 'appliquer'])
  })

  it('place les cartes sous leur section', () => {
    expect(m[0].rows.map(r => [r.nodeId, r.level])).toEqual([['tests', 0], ['tests/junior', 1]])
  })

  it('marque « pas encore décrit » un profil hors fabrique', () => {
    expect(m[0].rows[0].cells.sans).toEqual({ state: 'na' })
  })

  it('distingue affichée, absente, conditionnelle et interdite', () => {
    const cell = (etape, id, p) => m.find(g => g.etape === etape).rows.find(r => r.nodeId === id).cells[p]
    expect(cell('mesurer', 'tests', 'a').state).toBe('shown')
    expect(cell('acquerir', 'sessions', 'a').state).toBe('conditional')
    expect(cell('acquerir', 'sessions', 'obs').state).toBe('absent')
    expect(cell('appliquer', 'journal', 'a')).toEqual({ state: 'locked', reason: 'role' })
    expect(cell('mesurer', 'tests/junior', 'obs')).toEqual({ state: 'locked', reason: 'observer' })
  })
})

describe('lockReason', () => {
  it('ne bloque rien sans condition', () => {
    expect(lockReason({ id: 'x' }, 'trainer', { key: 'trainer' })).toBeNull()
  })
})

describe('configs réelles', () => {
  it('le formateur est dans la fabrique et chaque étape est connue', () => {
    expect(profilesInFactory(PORTAL_CONFIGS, ['learner', 'trainer'])).toEqual(['trainer'])
    const m = portalMatrix(PORTAL_CONFIGS, ['trainer'])
    for (const g of m) expect([...MEDACAP_ETAPES, 'autre']).toContain(g.etape)
    expect(m.flatMap(g => g.rows).some(r => r.nodeId === 'assistance')).toBe(true)
  })

  it('consultation : une colonne par rôle, sections et cartes selon le rôle', () => {
    const m = portalMatrix(PORTAL_CONFIGS, ['group_hr', 'regional_director', 'branch_admin'])
    const cell = (id, p) => m.flatMap(g => g.rows).find(r => r.nodeId === id).cells[p]
    expect(cell('cle', 'group_hr')).toEqual({ state: 'locked', reason: 'role' })
    expect(cell('cle', 'branch_admin').state).toBe('shown')
    expect(cell('cle/region', 'regional_director').state).toBe('shown')
    expect(cell('cle/region', 'branch_admin')).toEqual({ state: 'locked', reason: 'role' })
    expect(cell('besoins', 'branch_admin').state).toBe('shown')
    expect(cell('competences', 'regional_director').state).toBe('shown')
  })
})
