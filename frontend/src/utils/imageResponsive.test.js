import { describe, expect, it } from 'vitest'
import manifeste from '../data/imagesResponsives.json'
import { fondResponsive, imageResponsive } from './imageResponsive.js'

describe('imageResponsive', () => {
  it('donne srcset, dimensions et flou pour une image du manifeste', () => {
    const entree = manifeste['hero/default.jpg']
    const r = imageResponsive('/assets/hero/default.jpg')
    expect(r.width).toBe(entree.w)
    expect(r.height).toBe(entree.h)
    expect(r.flou).toMatch(/^data:image\/webp;base64,/)
    expect(r.srcSet.split(', ')).toHaveLength(entree.v.length)
    expect(r.srcSet).toContain(`/assets/_r/hero/default-${entree.v[0]}.webp ${entree.v[0]}w`)
    expect(r.src).toBe(`/assets/_r/hero/default-${entree.v.at(-1)}.webp`)
  })

  it('décode un chemin encodé (accents)', () => {
    const cle = Object.keys(manifeste).find((k) => /[^\x00-\x7f]/.test(k))
    if (!cle) return
    expect(imageResponsive(`/assets/${encodeURI(cle)}`)).not.toBeNull()
  })

  it('laisse passer ce qui est hors manifeste', () => {
    expect(imageResponsive('/assets/logos/toyota.png')).toBeNull()
    expect(imageResponsive('https://exemple.test/a.jpg')).toBeNull()
    expect(imageResponsive(undefined)).toBeNull()
  })

  it('fond : plus petite variante couvrant la largeur, au-dessus du flou', () => {
    const v = manifeste['hero/default.jpg'].v
    const f = fondResponsive('/assets/hero/default.jpg', v[0] - 1)
    expect(f.url).toBe(`/assets/_r/hero/default-${v[0]}.webp`)
    expect(f.image).toMatch(/^url\('\/assets\/_r\/hero\/default-\d+\.webp'\), url\('data:image\/webp/)
    expect(fondResponsive('/assets/hero/default.jpg', 99999).url).toContain(`-${v.at(-1)}.webp`)
    expect(fondResponsive('/x.jpg', 800)).toEqual({ url: '/x.jpg', image: "url('/x.jpg')" })
  })

  it('chaque variante du manifeste existe sur le disque', async () => {
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const racine = resolve(__dirname, '../../../assets/_r')
    if (!existsSync(racine)) return // conteneur sans le dossier assets
    const manquantes = Object.entries(manifeste).flatMap(([cle, e]) =>
      e.v.map((w) => `${cle.replace(/\.[^./]+$/, '')}-${w}.webp`)
        .filter((rel) => !existsSync(resolve(racine, rel))))
    expect(manquantes).toEqual([])
  })
})
