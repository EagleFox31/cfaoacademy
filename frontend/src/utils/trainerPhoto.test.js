import { describe, expect, it, vi } from 'vitest'
import { splitTrainers, trainerInitials, trainerPhoto } from './trainerPhoto'

vi.mock('../data/academy/equipe-poles.json', () => ({
  default: {
    poles: [
      { members: [{ name: 'Awa ÉTÉ', photo: '/assets/team/awa-ete.png' }] },
      { members: [{ name: 'Koffi Yao TESTEUR', photo: '/assets/team/koffi-testeur.png' }, { name: 'Sans PHOTO' }] },
    ],
  },
}))

describe('photo d’un formateur', () => {
  it('retrouve la photo malgré la casse et les accents', () => {
    expect(trainerPhoto('AWA ETE')).toBe('/assets/team/awa-ete.png')
    expect(trainerPhoto('awa été')).toBe('/assets/team/awa-ete.png')
  })

  it('accepte un nom inversé ou partiel', () => {
    expect(trainerPhoto('ETE Awa')).toBe('/assets/team/awa-ete.png')
    expect(trainerPhoto('Koffi TESTEUR')).toBe('/assets/team/koffi-testeur.png')
  })

  it('ne devine pas sur un seul mot ni sur un inconnu', () => {
    expect(trainerPhoto('Koffi')).toBeNull()
    expect(trainerPhoto('Formateur externe')).toBeNull()
    expect(trainerPhoto('Sans PHOTO')).toBeNull()
    expect(trainerPhoto('')).toBeNull()
  })

  it('sépare plusieurs formateurs et donne des initiales', () => {
    expect(splitTrainers('Awa ETE, Koffi TESTEUR / PIC')).toEqual(['Awa ETE', 'Koffi TESTEUR', 'PIC'])
    expect(splitTrainers(null)).toEqual([])
    expect(trainerInitials('Formateur externe')).toBe('FE')
  })
})
