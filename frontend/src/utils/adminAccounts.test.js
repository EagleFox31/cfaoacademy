import { describe, expect, it } from 'vitest'
import {
  branchLabel, displayName, filterAccounts, leafCodes, plural, roleCounts, roleLabel,
} from './adminAccounts.js'

const UNITS = [
  { code: 'groupe', name: 'CFAO', kind: 'group' },
  { code: 'groupe.cmr', name: 'Cameroun', kind: 'branch' },
  { code: 'groupe.civ', name: "Côte d'Ivoire", kind: 'branch' },
]

const USERS = [
  { email: 'a@x.io', first_name: 'Awa', last_name: 'Diop', roles: ['dps', 'learner'], scope_paths: ['groupe', 'groupe.cmr'] },
  { email: 'b@x.io', first_name: '', last_name: '', roles: ['learner'], scope_paths: ['groupe', 'groupe.civ'] },
  { email: 'c@x.io', first_name: 'Paul', last_name: 'Mba', roles: [], scope_paths: ['groupe'] },
]

describe('roleLabel', () => {
  it('prend le texte du portail, puis de la console, puis le catalogue', () => {
    expect(roleLabel('dps', { tPortal: { role_dps: 'DPS' }, tAdmin: { role_dps: 'x' } })).toBe('DPS')
    expect(roleLabel('candidate', { tAdmin: { role_candidate: 'Candidat' } })).toBe('Candidat')
    expect(roleLabel('zz', { catalog: [{ code: 'zz', description: 'Zed' }] })).toBe('Zed')
    expect(roleLabel('inconnu')).toBe('inconnu')
  })
})

describe('filiales', () => {
  it('garde les codes les plus profonds', () => {
    expect(leafCodes(['groupe', 'groupe.cmr', 'groupe.civ'])).toEqual(['groupe.cmr', 'groupe.civ'])
  })

  it('affiche les noms des filiales, jamais les codes', () => {
    expect(branchLabel(['groupe', 'groupe.cmr'], UNITS, 'Tout le groupe')).toBe('Cameroun')
    expect(branchLabel(['groupe'], UNITS, 'Tout le groupe')).toBe('Tout le groupe')
    expect(branchLabel([], UNITS, 'Tout le groupe')).toBe('')
  })

  it('se replie sur un nom court si l\'unité est inconnue', () => {
    expect(branchLabel(['groupe', 'groupe.gab'], [], 'Tout le groupe')).toBe('GAB')
  })
})

describe('comptes', () => {
  it('nomme un compte, ou à défaut par son e-mail', () => {
    expect(displayName(USERS[0])).toBe('Awa Diop')
    expect(displayName(USERS[1])).toBe('b@x.io')
  })

  it('filtre par texte et par rôle', () => {
    expect(filterAccounts(USERS, { q: 'diop' })).toHaveLength(1)
    expect(filterAccounts(USERS, { q: 'B@X' })).toHaveLength(1)
    expect(filterAccounts(USERS, { role: 'learner' })).toHaveLength(2)
    expect(filterAccounts(USERS, { q: 'paul', role: 'learner' })).toHaveLength(0)
  })

  it('compte les comptes par rôle', () => {
    expect(roleCounts(USERS)).toEqual({ dps: 1, learner: 2 })
  })

  it('accorde le pluriel', () => {
    const t = { n_acc: '{n} comptes', n_acc_one: '{n} compte' }
    expect(plural(t, 'n_acc', 1)).toBe('1 compte')
    expect(plural(t, 'n_acc', 3)).toBe('3 comptes')
  })
})
