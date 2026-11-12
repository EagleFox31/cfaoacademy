import { describe, expect, it } from 'vitest'
import {
  canSeePlanning, CENTER_ROLES, centreSeul, pageAccueil, pageCentreAutorisee,
  planningMenu, PLANNING_HOME, PLANNING_ROLES,
} from './planningAccess'

const ALL = { view: true, manage: true, freeze: true, import: true, gaps: true }

describe('menu de la clé de répartition par rôle', () => {
  it('équipe Academy : 5 entrées, Saisie puis Préparer en dernier', () => {
    expect(planningMenu(ALL)).toEqual(['table', 'country', 'themes', 'settings', 'prepare'])
  })
  it('observateur (DPS/DOP) : lecture et formations non choisies, rien à saisir ni préparer', () => {
    expect(planningMenu({ ...ALL, manage: false, freeze: false, import: false }))
      .toEqual(['table', 'country', 'themes'])
  })
  it('filiale : sa filiale d\'abord', () => {
    expect(planningMenu({ view: true }, { scoped: true })).toEqual(['country', 'table'])
  })
  it('import seul : Préparer sans Saisie', () => {
    expect(planningMenu({ view: true, import: true })).toEqual(['table', 'country', 'prepare'])
    expect(planningMenu(ALL, { roles: ['center_director'] })).not.toContain('prepare')
    expect(planningMenu(ALL, { roles: ['center_director'] })).toContain('settings')
    expect(planningMenu(ALL, { roles: ['training_coordinator'] })).toContain('prepare')
    expect(planningMenu(ALL, { roles: ['center_director', 'training_coordinator'] })).toContain('prepare')
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
  it('équipe du centre : son portail', () => {
    for (const role of CENTER_ROLES) {
      expect(pageAccueil([role])).toBe('/portail')
      expect(centreSeul([role])).toBe(true)
    }
  })
  it('un autre rôle de portail garde tout le portail', () => {
    expect(centreSeul(['center_director', 'superadmin'])).toBe(false)
    expect(centreSeul(['training_coordinator', 'dps'])).toBe(false)
    expect(pageAccueil(['center_director', 'superadmin'])).toBe('/portail')
  })
  it('seule l\'équipe du centre est réduite à sa vitrine et à la clé', () => {
    for (const role of PLANNING_ROLES.filter(r => !CENTER_ROLES.includes(r))) {
      expect(centreSeul([role])).toBe(false)
    }
  })
})

describe('pageCentreAutorisee', () => {
  it('la vitrine et la clé de répartition', () => {
    expect(pageCentreAutorisee('/portail')).toBe(true)
    expect(pageCentreAutorisee(PLANNING_HOME)).toBe(true)
    expect(pageCentreAutorisee(`${PLANNING_HOME}/country`)).toBe(true)
  })
  it('rien d\'autre dans le portail', () => {
    expect(pageCentreAutorisee('/portail/assistance')).toBe(false)
    expect(pageCentreAutorisee('/portail/cle-repartition-bis')).toBe(false)
  })
})
