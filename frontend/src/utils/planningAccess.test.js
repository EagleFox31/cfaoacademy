import { describe, expect, it } from 'vitest'
import { canSeePlanning, pageAccueil, planningMenu, PLANNING_HOME } from './planningAccess'

const ALL = { view: true, manage: true, freeze: true, import: true, gaps: true }

describe('menu de la clé de répartition par rôle', () => {
  it('équipe Academy : 6 entrées, Saisie puis Préparer en dernier', () => {
    expect(planningMenu(ALL)).toEqual(['table', 'country', 'abc', 'themes', 'settings', 'prepare'])
  })
  it('observateur (DPS/DOP) : lecture et formations non choisies, rien à saisir ni préparer', () => {
    expect(planningMenu({ ...ALL, manage: false, freeze: false, import: false }))
      .toEqual(['table', 'country', 'abc', 'themes'])
  })
  it('filiale : sa filiale d\'abord', () => {
    expect(planningMenu({ view: true }, { scoped: true })).toEqual(['country', 'table', 'abc'])
  })
  it('import seul : Préparer sans Saisie', () => {
    expect(planningMenu({ view: true, import: true })).toEqual(['table', 'country', 'abc', 'prepare'])
  })
  it('sans droit de lecture : aucun menu', () => {
    expect(planningMenu({ view: false })).toEqual([])
    expect(planningMenu(null)).toEqual([])
  })
  it('jamais plus de 6 entrées', () => {
    expect(planningMenu(ALL, { scoped: true }).length).toBeLessThanOrEqual(6)
  })
  it('entrée de navbar réservée aux rôles de pilotage', () => {
    expect(canSeePlanning(['dps'])).toBe(true)
    expect(canSeePlanning(['learner', 'trainer'])).toBe(false)
  })
})

describe('page d\'arrivée après connexion', () => {
  it('rôle planning seul : droit sur la clé de répartition', () => {
    expect(pageAccueil(['planning_viewer'])).toBe(PLANNING_HOME)
  })
  it('rôle de portail : le portail, même avec le planning', () => {
    expect(pageAccueil(['dps'])).toBe('/portail')
    expect(pageAccueil(['learner', 'ki'])).toBe('/portail')
  })
  it('sans rôle : le portail', () => {
    expect(pageAccueil([])).toBe('/portail')
    expect(pageAccueil(undefined)).toBe('/portail')
  })
})
