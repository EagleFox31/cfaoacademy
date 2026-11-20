import { describe, expect, it } from 'vitest'
import {
  absoluteTime, canSeeSupervision, fill, modulePath, relativeTime, sortModules, statusTone, summarize,
  supervisionPath, STATUS_ORDER,
} from './supervisionStatus.js'

describe('supervision : accès et chemins', () => {
  it('réservée à l’exploitation et au super admin', () => {
    expect(canSeeSupervision(['platform_ops'])).toBe(true)
    expect(canSeeSupervision(['superadmin'])).toBe(true)
    expect(canSeeSupervision(['trainer', 'center_director'])).toBe(false)
    expect(canSeeSupervision(null)).toBe(false)
  })

  it('chemins des vues et d’un module', () => {
    expect(supervisionPath()).toBe('/portail/supervision')
    expect(supervisionPath('connections')).toBe('/portail/supervision/connections')
    expect(modulePath('cfao planning')).toBe('/portail/supervision/modules/cfao%20planning')
  })
})

describe('supervision : états', () => {
  it('chaque état connu de l’API a sa couleur, un inconnu reste neutre', () => {
    expect(STATUS_ORDER.map(statusTone)).toEqual(['blocked', 'blocked', 'warn', 'in_progress', 'done', 'done'])
    expect(statusTone('bizarre')).toBe('todo')
  })

  it('les modules en panne passent devant, puis par nom', () => {
    const sorted = sortModules([
      { project: 'b', name: 'B', status: 'ok' },
      { project: 'a', name: 'A', status: 'ok' },
      { project: 'c', name: 'C', status: 'down' },
      { project: 'd', name: 'D', status: 'degraded' },
    ])
    expect(sorted.map(m => m.project)).toEqual(['c', 'd', 'a', 'b'])
  })

  it('trois chiffres : en ligne, à surveiller, en panne', () => {
    expect(summarize({ ok: 5, done: 1, starting: 1, degraded: 2, crashloop: 1, down: 2 }))
      .toEqual({ up: 6, watch: 3, down: 3 })
    expect(summarize()).toEqual({ up: 0, watch: 0, down: 0 })
  })
})

describe('supervision : textes et dates', () => {
  const now = Date.parse('2026-11-19T10:00:00Z')

  it('date relative lisible, null si absente', () => {
    expect(relativeTime('2026-11-19T09:57:00Z', 'fr', now)).toBe('il y a 3 minutes')
    expect(relativeTime('2026-11-18T10:00:00Z', 'en', now)).toBe('yesterday')
    expect(relativeTime('2026-11-19T09:59:50Z', 'fr', now)).toBe('cette minute-ci')
    expect(relativeTime(null)).toBeNull()
    expect(relativeTime('pas une date')).toBeNull()
  })

  it('date complète, null si illisible', () => {
    expect(absoluteTime('2026-11-19T09:57:00Z', 'fr')).toMatch(/2026/)
    expect(absoluteTime('')).toBeNull()
  })

  it('remplit les variables, garde visibles celles qui manquent', () => {
    expect(fill('{n} conteneur(s), port {port}', { n: 3 })).toBe('3 conteneur(s), port {port}')
    expect(fill(undefined)).toBe('')
  })
})
