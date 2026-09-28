import { describe, expect, it } from 'vitest'
import {
  DISPOSITIONS, dispositionsPour, idDisposition, modeLegende, modesLegendePour,
} from './dispositions_photos'

const photos = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }))

describe('dispositions des photos', () => {
  it('ne propose que des dispositions sans legende integree', () => {
    expect(DISPOSITIONS.some(d => /legend/.test(d.id))).toBe(false)
    for (const n of [1, 2, 3, 4, 5]) expect(dispositionsPour(n).length).toBeGreaterThan(0)
  })

  it('ramene une ancienne disposition legendee a sa disposition de base', () => {
    expect(idDisposition('deux-empilees-legendees')).toBe('deux-empilees')
    expect(idDisposition('deux-empilees')).toBe('deux-empilees')
    expect(idDisposition(undefined)).toBeNull()
  })
})

describe('modes de legende', () => {
  it('propose trois modes a plusieurs photos, deux a une seule', () => {
    expect(modesLegendePour(3).map(m => m.id)).toEqual(['aucune', 'chaque', 'commune'])
    expect(modesLegendePour(1).map(m => m.nom)).toEqual(['Sans légende', 'Avec légende'])
  })

  it('prend le mode choisi en priorite', () => {
    const b = { photos: { 'jour-1': photos(2) }, modesLegende: { 'jour-1': 'commune' } }
    expect(modeLegende(b, 'jour-1')).toBe('commune')
  })

  it('deduit le mode d’un ancien brouillon', () => {
    const legendee = { photos: { j: photos(2) }, dispositions: { j: 'deux-empilees-legendees' } }
    const commune = { photos: { j: photos(2) }, legendes: { j: 'Atelier moteur' } }
    expect(modeLegende(legendee, 'j')).toBe('chaque')
    expect(modeLegende(commune, 'j')).toBe('commune')
    expect(modeLegende({ photos: { j: photos(2) } }, 'j')).toBe('aucune')
  })

  it('n’a pas de legende commune pour une seule photo', () => {
    const b = { photos: { j: photos(1) }, modesLegende: { j: 'commune' } }
    expect(modeLegende(b, 'j')).toBe('chaque')
  })
})
