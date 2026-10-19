import { describe, expect, it } from 'vitest'
import { adressePhoto, ancrerPhotos, relancerPhoto, srcPhoto } from './photosService'

describe('adresse affichee des photos', () => {
  it('ignore l\'adresse sans version gardee dans un ancien brouillon', () => {
    const p = { id: 'a', ref: 'a727fedcd588a83b', apercu: '/cr-donnees/photos/a727fedcd588a83b.jpg' }
    expect(srcPhoto(p)).toBe('/cr-donnees/photos/a727fedcd588a83b.jpg?v=2')
  })

  it('garde l\'adresse locale tant que la photo n\'est pas envoyee', () => {
    expect(srcPhoto({ id: 'a', apercu: 'blob:http://x/1' })).toBe('blob:http://x/1')
    expect(srcPhoto(undefined)).toBeUndefined()
  })

  it('ancre une photo envoyee sous l\'adresse versionnee', () => {
    const patch = ancrerPhotos({ photos: { objectifs: [{ id: 'a', apercu: 'blob:x' }] } }, { a: 'f00d' })
    expect(patch.photos.objectifs[0]).toMatchObject({ ref: 'f00d', apercu: adressePhoto('f00d') })
    expect(adressePhoto('f00d')).toBe('/cr-donnees/photos/f00d.jpg?v=2')
  })
})

describe('photo qui ne se charge pas', () => {
  const img = src => ({ currentTarget: { src, dataset: {} } })

  it('est redemandee une seule fois en contournant le cache', () => {
    const e = img('http://h/cr-donnees/photos/f00d.jpg?v=2')
    relancerPhoto(e)
    expect(e.currentTarget.src).toMatch(/^http:\/\/h\/cr-donnees\/photos\/f00d\.jpg\?v=2&r=\d+$/)
    const deuxieme = e.currentTarget.src
    relancerPhoto(e)
    expect(e.currentTarget.src).toBe(deuxieme)
  })

  it('laisse les images locales tranquilles', () => {
    const e = img('blob:http://h/1')
    relancerPhoto(e)
    expect(e.currentTarget.src).toBe('blob:http://h/1')
  })
})
